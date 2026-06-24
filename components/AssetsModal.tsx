'use client';

import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { PRINT_CONTRACTS } from '@/lib/contracts';
import { readUserPrintBalance, readUserPrintTokenIds, readUserTokenData, readEthBalance } from '@/lib/client-reads';
import { formatTokenAmountShort } from '@/lib/formatting';
import type { ContractStats } from '@/lib/reads';
import styles from './AssetsModal.module.css';

interface AssetsModalProps {
  onClose: () => void;
  statsMap: Record<string, ContractStats | null>;
}

type UserData = {
  ethBalance: bigint;
  byContract: Record<string, {
    nftBalance: bigint;
    tokenIds: bigint[];
    tokenBalance: bigint;
    allowance: bigint;
  }>;
};

export default function AssetsModal({ onClose, statsMap }: AssetsModalProps) {
  const { address } = useAccount();
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);

    async function load() {
      if (!address) return;
      const ethBalance = await readEthBalance(address).catch(() => 0n);

      const entries = await Promise.all(
        PRINT_CONTRACTS.map(async (c) => {
          const s = statsMap[c.address];
          const nftBalance = await readUserPrintBalance(c.address, address).catch(() => 0n);
          const tokenIds = await readUserPrintTokenIds(c.address, address, nftBalance).catch(() => []);
          const { balance: tokenBalance, allowance } = s
            ? await readUserTokenData(s.tokenAddress, c.address, address).catch(() => ({ balance: 0n, allowance: 0n }))
            : { balance: 0n, allowance: 0n };
          return [c.address, { nftBalance, tokenIds, tokenBalance, allowance }] as const;
        })
      );

      setData({ ethBalance, byContract: Object.fromEntries(entries) });
      setLoading(false);
    }

    load();
  }, [address, statsMap]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Wallet Assets</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {address && <p className={styles.address}>{address}</p>}

        {loading ? (
          <p className={styles.rowLabel}>Loading…</p>
        ) : (
          <>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Balances</p>
              <div className={styles.row}>
                <span className={styles.rowLabel}>ETH</span>
                <span className={styles.rowValue}>
                  {data ? (Number(data.ethBalance) / 1e18).toFixed(4) : '…'} ETH
                </span>
              </div>
              {PRINT_CONTRACTS.map((c) => {
                const s = statsMap[c.address];
                const d = data?.byContract[c.address];
                if (!s || !d) return null;
                return (
                  <div key={c.address} className={styles.row}>
                    <span className={styles.rowLabel}>{s.tokenSymbol}</span>
                    <span className={styles.rowValue}>
                      {formatTokenAmountShort(d.tokenBalance, s.tokenDecimals)} {s.tokenSymbol}
                    </span>
                  </div>
                );
              })}
            </div>

            {PRINT_CONTRACTS.map((c) => {
              const s = statsMap[c.address];
              const d = data?.byContract[c.address];
              if (!d) return null;
              const hasAllowance = s ? d.allowance >= s.price : false;
              return (
                <div key={c.address} className={styles.section}>
                  <p className={styles.sectionTitle}>{c.label} Prints</p>
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Count</span>
                    <span className={styles.rowValue}>{d.nftBalance.toString()}</span>
                  </div>
                  {d.tokenIds.length > 0 && (
                    <div className={styles.row}>
                      <span className={styles.rowLabel}>Token IDs</span>
                      <span className={styles.tokenIds}>{d.tokenIds.map(String).join(', ')}</span>
                    </div>
                  )}
                  {s && (
                    <div className={styles.row}>
                      <span className={styles.rowLabel}>Allowance</span>
                      {hasAllowance
                        ? <span className={styles.allowanceOk}>Approved</span>
                        : <span className={styles.allowanceNeeded}>Not approved</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
