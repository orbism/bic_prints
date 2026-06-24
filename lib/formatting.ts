export function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  return whole.toLocaleString('en-US');
}

export function formatTokenAmountShort(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = Number(raw / divisor);
  if (whole >= 1_000_000_000) return `${(whole / 1_000_000_000).toFixed(1)}B`;
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(1)}M`;
  if (whole >= 1_000) return `${(whole / 1_000).toFixed(1)}K`;
  return whole.toLocaleString('en-US');
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
