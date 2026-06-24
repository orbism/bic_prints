import { PRINT_ABI, ERC20_ABI } from './abis';
import { MAX_PER_TX } from './contracts';

export function buildApproveCall(
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint
) {
  return {
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve' as const,
    args: [spender, amount] as const,
  };
}

export function buildLockCall(printAddress: `0x${string}`, qty: number) {
  const safeQty = Math.min(qty, MAX_PER_TX);
  if (safeQty === 1) {
    return {
      address: printAddress,
      abi: PRINT_ABI,
      functionName: 'print' as const,
      args: [] as const,
    };
  }
  return {
    address: printAddress,
    abi: PRINT_ABI,
    functionName: 'printMultiple' as const,
    args: [BigInt(safeQty)] as const,
  };
}

export function buildRedeemCall(printAddress: `0x${string}`, qty: number) {
  const safeQty = Math.min(qty, MAX_PER_TX);
  if (safeQty === 1) {
    return {
      address: printAddress,
      abi: PRINT_ABI,
      functionName: 'redeem' as const,
      args: [] as const,
    };
  }
  return {
    address: printAddress,
    abi: PRINT_ABI,
    functionName: 'redeemMultiple' as const,
    args: [BigInt(safeQty)] as const,
  };
}
