import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';

// Server-only: these env vars have no NEXT_PUBLIC_ prefix and are never sent to the browser.
// Client-side reads go through /api/rpc proxy instead.
const alchemyRpc = process.env.ALCHEMY_ETH_RPC!;
const infuraRpc = process.env.INFURA_ETH_RPC!;

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([http(alchemyRpc), http(infuraRpc)]),
  batch: { multicall: true },
});
