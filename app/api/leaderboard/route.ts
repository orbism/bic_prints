import { prisma } from '@/lib/prisma';
import { PRINT_CONTRACTS } from '@/lib/contracts';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const CACHE_TTL_MS = 60 * 60 * 1000;
const MIN_REFRESH_MS = 5 * 60 * 1000;
const ZERO = '0x0000000000000000000000000000000000000000';

export type LeaderboardEntry = {
  address: string;
  ensName: string | null;
  fdp: number;
  adp: number;
  total: number;
};

// In-memory ENS cache — persists across requests within a single server process
const ensCache = new Map<string, { name: string | null; expiry: number }>();
const ENS_TTL = 24 * 60 * 60 * 1000;

async function resolveEnsNames(addresses: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const toResolve: string[] = [];
  const now = Date.now();

  for (const addr of addresses) {
    const cached = ensCache.get(addr);
    if (cached && cached.expiry > now) {
      result.set(addr, cached.name);
    } else {
      toResolve.push(addr);
    }
  }

  if (toResolve.length > 0) {
    try {
      const { publicClient } = await import('@/lib/rpc');
      const names = await Promise.all(
        toResolve.map((addr) =>
          publicClient.getEnsName({ address: addr as `0x${string}` }).catch(() => null)
        )
      );
      for (let i = 0; i < toResolve.length; i++) {
        const name = names[i] ?? null;
        ensCache.set(toResolve[i], { name, expiry: now + ENS_TTL });
        result.set(toResolve[i], name);
      }
    } catch {
      for (const addr of toResolve) result.set(addr, null);
    }
  }

  return result;
}

async function withEns(holders: { address: string; fdpCount: number; adpCount: number }[]): Promise<LeaderboardEntry[]> {
  const entries = holders
    .filter((h) => h.fdpCount + h.adpCount > 0)
    .sort((a, b) => (b.fdpCount + b.adpCount) - (a.fdpCount + a.adpCount) || b.fdpCount - a.fdpCount)
    .map((h) => ({ address: h.address, fdp: h.fdpCount, adp: h.adpCount, total: h.fdpCount + h.adpCount }));

  const ens = await resolveEnsNames(entries.map((e) => e.address));

  return entries.map((e) => ({ ...e, ensName: ens.get(e.address) ?? null }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === '1';

  const apiKey = process.env.ETHERSCAN_API_KEY;

  // Check cache age
  const meta = await prisma.snapshotMeta.findUnique({ where: { id: 1 } }).catch(() => null);
  const ageMs = meta ? Date.now() - meta.lastFetched.getTime() : Infinity;
  const isStale = ageMs > CACHE_TTL_MS;
  const tooSoon = ageMs < MIN_REFRESH_MS;

  const shouldRefresh = apiKey && (isStale || (force && !tooSoon));

  if (shouldRefresh) {
    try {
      await refreshFromEtherscan(apiKey);
    } catch (e) {
      console.error('Etherscan sync failed:', e);
    }
  }

  try {
    const holders = await prisma.holder.findMany({ orderBy: [{ fdpCount: 'desc' }, { adpCount: 'desc' }] });
    return Response.json(await withEns(holders));
  } catch (e) {
    console.error('DB read failed:', e);
    return Response.json({ error: 'Database unavailable — run: npx prisma migrate dev --name init' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const { address } = await req.json() as { address: string };
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });

  const [fdpContract, adpContract] = PRINT_CONTRACTS;

  try {
    const { publicClient } = await import('@/lib/rpc');
    const { PRINT_ABI } = await import('@/lib/abis');

    const [fdp, adp] = await publicClient.multicall({
      contracts: [
        { address: fdpContract.address, abi: PRINT_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] },
        { address: adpContract.address, abi: PRINT_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] },
      ],
      allowFailure: false,
    });

    await prisma.holder.upsert({
      where: { address: address.toLowerCase() },
      create: { address: address.toLowerCase(), fdpCount: Number(fdp), adpCount: Number(adp) },
      update: { fdpCount: Number(fdp), adpCount: Number(adp) },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Holder update failed:', e);
    return Response.json({ error: 'update failed' }, { status: 500 });
  }
}

async function refreshFromEtherscan(apiKey: string) {
  const [fdpContract, adpContract] = PRINT_CONTRACTS;

  const [fdpHolders, adpHolders] = await Promise.all([
    fetchHolderCounts(fdpContract.address, apiKey),
    fetchHolderCounts(adpContract.address, apiKey),
  ]);

  const allAddresses = new Set([...Object.keys(fdpHolders), ...Object.keys(adpHolders)]);

  await prisma.$transaction([
    prisma.holder.deleteMany(),
    prisma.holder.createMany({
      data: Array.from(allAddresses)
        .map((addr) => ({
          address: addr,
          fdpCount: fdpHolders[addr] ?? 0,
          adpCount: adpHolders[addr] ?? 0,
        }))
        .filter((h) => h.fdpCount + h.adpCount > 0),
    }),
    prisma.snapshotMeta.upsert({
      where: { id: 1 },
      create: { id: 1, lastFetched: new Date() },
      update: { lastFetched: new Date() },
    }),
  ]);
}

async function fetchHolderCounts(contractAddress: string, apiKey: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let page = 1;

  while (true) {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', '1');
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokennfttx');
    url.searchParams.set('contractaddress', contractAddress);
    url.searchParams.set('page', String(page));
    url.searchParams.set('offset', '1000');
    url.searchParams.set('sort', 'asc');
    url.searchParams.set('apikey', apiKey);

    const res = await fetch(url.toString());
    const json = await res.json();

    if (json.status !== '1' || !Array.isArray(json.result) || json.result.length === 0) break;

    for (const tx of json.result) {
      const from = tx.from.toLowerCase();
      const to = tx.to.toLowerCase();
      if (from !== ZERO) counts[from] = (counts[from] ?? 0) - 1;
      if (to !== ZERO) counts[to] = (counts[to] ?? 0) + 1;
    }

    if (json.result.length < 1000) break;
    page++;
  }

  return counts;
}
