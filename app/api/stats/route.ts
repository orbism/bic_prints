import { fetchContractStats } from '@/lib/reads';
import { PRINT_CONTRACTS } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.all(
    PRINT_CONTRACTS.map((c) =>
      fetchContractStats(c.address)
        .then((s) => [c.address, s] as const)
        .catch((e) => {
          console.error(`Stats fetch failed for ${c.address}:`, e);
          return [c.address, null] as const;
        })
    )
  );
  return new Response(
    JSON.stringify(Object.fromEntries(results), (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    ),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
