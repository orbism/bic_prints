'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { getConnectorClient, waitForTransactionReceipt, switchChain } from 'wagmi/actions';
import { writeContract } from 'viem/actions';
import { mainnet } from 'wagmi/chains';
import { buildApproveCall, buildLockCall, buildRedeemCall } from '@/lib/writes';
import { formatTokenAmountShort } from '@/lib/formatting';
import { MAX_PER_TX } from '@/lib/contracts';
import { wagmiConfig } from '@/lib/wagmi';
import { readUserPrintBalance, readUserTokenData } from '@/lib/client-reads';
import type { ContractStats } from '@/lib/reads';
import styles from './PrintCard.module.css';

interface PrintCardProps {
  address: `0x${string}`;
  label: string;
  image: string;
  stats: ContractStats | null;
  loading: boolean;
  onComplete?: () => void;
}

type PhaseStatus = 'idle' | 'pending-wallet' | 'pending-chain' | 'confirmed' | 'failed';

interface TxPhase {
  label: string;
  status: PhaseStatus;
  hash?: `0x${string}`;
}

export default function PrintCard({ address, label, image, stats, loading, onComplete }: PrintCardProps) {
  const { address: userAddress, isConnected, chainId } = useAccount();
  const onWrongNetwork = isConnected && chainId !== mainnet.id;

  const [lockQty, setLockQty] = useState(1);
  const [redeemQty, setRedeemQty] = useState(1);
  const [phases, setPhases] = useState<TxPhase[]>([]);
  const [txError, setTxError] = useState<string | null>(null);

  const [nftBalance, setNftBalance] = useState<bigint | undefined>(undefined);
  const [tokenBalance, setTokenBalance] = useState<bigint | undefined>(undefined);
  const [allowance, setAllowance] = useState<bigint | undefined>(undefined);
  const [userReadsLoading, setUserReadsLoading] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userAddress || !stats?.tokenAddress) return;
    setUserReadsLoading(true);
    try {
      const [nb, td] = await Promise.all([
        readUserPrintBalance(address, userAddress),
        readUserTokenData(stats.tokenAddress, address, userAddress),
      ]);
      setNftBalance(nb);
      setTokenBalance(td.balance);
      setAllowance(td.allowance);
    } catch (e) {
      console.error('User read failed:', e);
    } finally {
      setUserReadsLoading(false);
    }
  }, [userAddress, address, stats?.tokenAddress]);

  useEffect(() => {
    if (!isConnected || onWrongNetwork) {
      setNftBalance(undefined);
      setTokenBalance(undefined);
      setAllowance(undefined);
      return;
    }
    fetchUserData();
  }, [isConnected, onWrongNetwork, fetchUserData]);

  const clampedLockQty = Math.max(1, Math.min(lockQty, MAX_PER_TX));
  const clampedRedeemQty = Math.max(1, Math.min(redeemQty, MAX_PER_TX));

  const totalLockCost = stats ? stats.price * BigInt(clampedLockQty) : 0n;
  const hasEnoughBalance = tokenBalance !== undefined && tokenBalance >= totalLockCost;
  const needsApproval = allowance !== undefined && allowance < totalLockCost;
  const displayNftBalance = nftBalance ?? 0n;
  const hasEnoughNfts = displayNftBalance >= BigInt(clampedRedeemQty);

  const busy = phases.some((p) => p.status === 'pending-wallet' || p.status === 'pending-chain');

  function patchPhase(idx: number, patch: Partial<TxPhase>) {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function markActiveFailed() {
    setPhases((prev) =>
      prev.map((p) =>
        p.status === 'pending-wallet' || p.status === 'pending-chain' ? { ...p, status: 'failed' } : p
      )
    );
  }

  // Update this user's leaderboard row from chain after a tx.
  // Awaited before onComplete() so the DB write lands before the leaderboard GET fires.
  async function notifyLeaderboard() {
    if (!userAddress) return;
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress }),
    }).catch(() => {});
  }

  // Get a fresh wallet client. Passing chain: mainnet to writeContract() causes viem to
  // call wallet_switchEthereumChain internally before presenting the sign prompt — so the
  // user is always on mainnet before they see any signature request.
  async function walletWrite(params: object): Promise<`0x${string}`> {
    // Explicitly switch to mainnet first — this is the only reliable way to guarantee
    // wallet_switchEthereumChain fires before the transaction prompt. viem's chain param
    // only asserts; it never switches. Already on mainnet = instant no-op.
    await switchChain(wagmiConfig, { chainId: mainnet.id });
    const client = await getConnectorClient(wagmiConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return writeContract(client as any, { ...params, chain: mainnet, account: userAddress } as any);
  }

  async function handleLock() {
    if (!stats || !userAddress) return;
    setTxError(null);

    const lockLabel = `Lock ${clampedLockQty} print${clampedLockQty > 1 ? 's' : ''}`;
    setPhases(
      needsApproval
        ? [
            { label: `Approve ${stats.tokenSymbol}`, status: 'pending-wallet' },
            { label: lockLabel, status: 'idle' },
          ]
        : [{ label: lockLabel, status: 'pending-wallet' }]
    );

    try {
      let lockIdx = 0;

      if (needsApproval) {
        const approveHash = await walletWrite(
          buildApproveCall(stats.tokenAddress, address, totalLockCost)
        );
        patchPhase(0, { status: 'pending-chain', hash: approveHash });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        patchPhase(0, { status: 'confirmed' });
        lockIdx = 1;
        setPhases((prev) => prev.map((p, i) => (i === 1 ? { ...p, status: 'pending-wallet' } : p)));
      }

      const lockHash = await walletWrite(buildLockCall(address, clampedLockQty));
      patchPhase(lockIdx, { status: 'pending-chain', hash: lockHash });
      await waitForTransactionReceipt(wagmiConfig, { hash: lockHash });
      patchPhase(lockIdx, { status: 'confirmed' });

      await fetchUserData();
      await notifyLeaderboard();
      onComplete?.();
      setTimeout(() => setPhases([]), 3500);
    } catch (e: unknown) {
      setTxError(getTxError(e));
      markActiveFailed();
      setTimeout(() => setPhases([]), 4000);
    }
  }

  async function handleRedeem() {
    if (!userAddress) return;
    setTxError(null);

    const redeemLabel = `Redeem ${clampedRedeemQty} print${clampedRedeemQty > 1 ? 's' : ''}`;
    setPhases([{ label: redeemLabel, status: 'pending-wallet' }]);

    try {
      const redeemHash = await walletWrite(buildRedeemCall(address, clampedRedeemQty));
      patchPhase(0, { status: 'pending-chain', hash: redeemHash });
      await waitForTransactionReceipt(wagmiConfig, { hash: redeemHash });
      patchPhase(0, { status: 'confirmed' });

      await fetchUserData();
      await notifyLeaderboard();
      onComplete?.();
      setTimeout(() => setPhases([]), 3500);
    } catch (e: unknown) {
      setTxError(getTxError(e));
      markActiveFailed();
      setTimeout(() => setPhases([]), 4000);
    }
  }

  const userLoading = isConnected && userReadsLoading;

  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        <Image
          src={image}
          alt={`${label} Doge`}
          fill
          className={styles.image}
          sizes="(max-width: 900px) 100vw, 50vw"
          priority
        />
      </div>

      <div className={styles.body}>
        <h2 className={styles.title}>{label}</h2>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total prints</span>
            <span className={styles.statValue}>
              {loading ? '…' : stats ? stats.totalSupply.toString() : '—'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total locked</span>
            <span className={styles.statValue}>
              {loading || !stats
                ? '…'
                : `${formatTokenAmountShort(stats.lockedBalance, stats.tokenDecimals)} ${stats.tokenSymbol}`}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Price per print</span>
            <span className={styles.statValue}>
              {loading || !stats
                ? '…'
                : `${formatTokenAmountShort(stats.price, stats.tokenDecimals)} ${stats.tokenSymbol}`}
            </span>
          </div>
          {isConnected && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>You own</span>
              <span className={styles.statValue}>
                {userLoading ? '…' : `${displayNftBalance.toString()} print${displayNftBalance !== 1n ? 's' : ''}`}
              </span>
            </div>
          )}
          {isConnected && tokenBalance !== undefined && stats && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Your {stats.tokenSymbol}</span>
              <span className={styles.statValueMuted}>
                {formatTokenAmountShort(tokenBalance, stats.tokenDecimals)}
              </span>
            </div>
          )}
        </div>

        {onWrongNetwork && (
          <div className={styles.networkNote}>
            Not on mainnet — will auto-switch on lock/redeem.
          </div>
        )}

        {phases.length > 0 && (
          <div className={styles.txTracker}>
            {phases.map((phase, i) => (
              <div key={i} className={styles.txStep}>
                <div className={styles.txStepIcon}>
                  {phase.status === 'confirmed' && <span className={styles.iconCheck}>✓</span>}
                  {phase.status === 'failed' && <span className={styles.iconFail}>✗</span>}
                  {(phase.status === 'pending-wallet' || phase.status === 'pending-chain') && (
                    <span className={styles.spinner} />
                  )}
                  {phase.status === 'idle' && <span className={styles.iconIdle}>○</span>}
                </div>
                <div className={styles.txStepBody}>
                  <div className={styles.txStepLabel}>{phase.label}</div>
                  <div className={styles.txStepSub}>
                    {phase.status === 'pending-wallet' && 'Confirm in wallet…'}
                    {phase.status === 'pending-chain' && 'Waiting for confirmation…'}
                    {phase.status === 'confirmed' && 'Confirmed'}
                    {phase.status === 'failed' && 'Failed'}
                    {phase.status === 'idle' && 'Pending'}
                  </div>
                  {phase.hash && (
                    <a
                      href={`https://etherscan.io/tx/${phase.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.txHash}
                    >
                      {phase.hash.slice(0, 10)}…{phase.hash.slice(-6)} ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {txError && <div className={styles.statusError}>{txError}</div>}

        {!isConnected ? (
          <p className={styles.connectPrompt}>Connect wallet to lock or redeem.</p>
        ) : (
          <div className={styles.actions}>
            <div className={styles.actionRow}>
              <span className={styles.actionLabel}>Lock</span>
              {stats && tokenBalance !== undefined && !hasEnoughBalance && totalLockCost > 0n && !busy && (
                <div className={styles.statusError} style={{ fontSize: 11, padding: '4px 8px' }}>
                  Insufficient {stats.tokenSymbol} balance.
                </div>
              )}
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.input}
                  min={1}
                  max={MAX_PER_TX}
                  value={lockQty}
                  onChange={(e) => setLockQty(Math.max(1, Math.min(Number(e.target.value), MAX_PER_TX)))}
                  disabled={busy}
                />
                <button
                  className={styles.btnPrimary}
                  onClick={handleLock}
                  disabled={busy || !hasEnoughBalance || !stats || userLoading}
                >
                  {busy ? '…' : needsApproval ? 'Approve & Lock' : 'Lock'}
                </button>
              </div>
              {stats && (
                <span className={styles.cap}>
                  Cost: {formatTokenAmountShort(totalLockCost, stats.tokenDecimals)} {stats.tokenSymbol} · max {MAX_PER_TX}/tx
                </span>
              )}
            </div>

            <div className={styles.actionRow}>
              <span className={styles.actionLabel}>Redeem</span>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  className={styles.input}
                  min={1}
                  max={Math.max(1, Number(displayNftBalance))}
                  value={redeemQty}
                  onChange={(e) => setRedeemQty(Math.max(1, Math.min(Number(e.target.value), MAX_PER_TX)))}
                  disabled={busy || displayNftBalance === 0n}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={handleRedeem}
                  disabled={busy || !hasEnoughNfts || displayNftBalance === 0n || userLoading}
                >
                  {busy ? '…' : 'Redeem'}
                </button>
              </div>
              {!userLoading && displayNftBalance === 0n && (
                <span className={styles.cap}>No prints to redeem.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getTxError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message.includes('User rejected') || e.message.includes('user rejected')) {
      return 'Transaction rejected.';
    }
    if (e.message.includes('insufficient funds')) {
      return 'Insufficient ETH for gas.';
    }
    return e.message.slice(0, 140);
  }
  return 'Unknown error.';
}
