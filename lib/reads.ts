import { publicClient } from './rpc';
import { PRINT_ABI, ERC20_ABI } from './abis';

export type ContractStats = {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  price: bigint;
  totalSupply: bigint;
  lockedBalance: bigint;
};

export type SerializedContractStats = {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  price: string;
  totalSupply: string;
  lockedBalance: string;
};

export function deserializeStats(s: SerializedContractStats): ContractStats {
  return {
    tokenAddress: s.tokenAddress,
    tokenSymbol: s.tokenSymbol,
    tokenDecimals: s.tokenDecimals,
    price: BigInt(s.price),
    totalSupply: BigInt(s.totalSupply),
    lockedBalance: BigInt(s.lockedBalance),
  };
}

export async function fetchContractStats(printAddress: `0x${string}`): Promise<ContractStats> {
  const [tokenAddress, price, totalSupply] = await publicClient.multicall({
    contracts: [
      { address: printAddress, abi: PRINT_ABI, functionName: 'token' },
      { address: printAddress, abi: PRINT_ABI, functionName: 'price' },
      { address: printAddress, abi: PRINT_ABI, functionName: 'totalSupply' },
    ],
    allowFailure: false,
  });

  const [decimals, symbol, lockedBalance] = await publicClient.multicall({
    contracts: [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [printAddress] },
    ],
    allowFailure: false,
  });

  return {
    tokenAddress,
    tokenSymbol: symbol,
    tokenDecimals: decimals,
    price,
    totalSupply,
    lockedBalance,
  };
}

export async function fetchUserTokenIds(
  printAddress: `0x${string}`,
  userAddress: `0x${string}`,
  balance: bigint
): Promise<bigint[]> {
  if (balance === 0n) return [];
  const indices = Array.from({ length: Number(balance) }, (_, i) => BigInt(i));
  const results = await publicClient.multicall({
    contracts: indices.map((i) => ({
      address: printAddress,
      abi: PRINT_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [userAddress, i],
    })),
    allowFailure: false,
  });
  return results as bigint[];
}
