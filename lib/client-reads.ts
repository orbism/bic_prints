import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { PRINT_ABI, ERC20_ABI } from './abis';

const client = createPublicClient({
  chain: mainnet,
  transport: http('/api/rpc'),
});

export async function readUserPrintBalance(
  printAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<bigint> {
  return client.readContract({
    address: printAddress,
    abi: PRINT_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  });
}

export async function readUserPrintTokenIds(
  printAddress: `0x${string}`,
  userAddress: `0x${string}`,
  balance: bigint
): Promise<bigint[]> {
  if (balance === 0n) return [];
  const indices = Array.from({ length: Number(balance) }, (_, i) => BigInt(i));
  const results = await client.multicall({
    contracts: indices.map((i) => ({
      address: printAddress,
      abi: PRINT_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [userAddress, i] as const,
    })),
    allowFailure: false,
  });
  return results as bigint[];
}

export type UserTokenData = {
  balance: bigint;
  allowance: bigint;
};

export async function readUserTokenData(
  tokenAddress: `0x${string}`,
  printAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<UserTokenData> {
  const results = await client.multicall({
    contracts: [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [userAddress, printAddress] },
    ],
    allowFailure: false,
  });
  return { balance: results[0] as bigint, allowance: results[1] as bigint };
}

export async function readEthBalance(userAddress: `0x${string}`): Promise<bigint> {
  return client.getBalance({ address: userAddress });
}
