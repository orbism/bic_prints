'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import PrintCard from '@/components/PrintCard';
import AssetsModal from '@/components/AssetsModal';
import Leaderboard from '@/components/Leaderboard';
import { PRINT_CONTRACTS } from '@/lib/contracts';
import { type ContractStats, type SerializedContractStats, deserializeStats } from '@/lib/reads';
import styles from './page.module.css';

export default function HomePage() {
  const { isConnected } = useAccount();
  const [statsMap, setStatsMap] = useState<Record<string, ContractStats | null>>({});
  const [loading, setLoading] = useState(true);
  const [showAssets, setShowAssets] = useState(false);
  const [leaderboardTrigger, setLeaderboardTrigger] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/stats');
      const data: Record<string, SerializedContractStats | null> = await r.json();
      const deserialized = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v ? deserializeStats(v) : null])
      );
      setStatsMap(deserialized);
    } catch {
      // keep existing stats on error
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  function handleComplete() {
    fetchStats();
    setLeaderboardTrigger((n) => n + 1);
  }

  return (
    <>
      <Header />

      {showAssets && isConnected && (
        <AssetsModal onClose={() => setShowAssets(false)} statsMap={statsMap} />
      )}

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Prints</h1>
          <p className={styles.subtitle}>Lock tokens into NFTs. Redeem anytime.</p>
        </div>

        <div className={styles.grid}>
          {PRINT_CONTRACTS.map((contract) => (
            <PrintCard
              key={contract.address}
              address={contract.address}
              label={contract.label}
              image={contract.image}
              stats={statsMap[contract.address] ?? null}
              loading={loading}
              onComplete={handleComplete}
            />
          ))}
        </div>

        {isConnected && (
          <div className={styles.assetsLink}>
            <button className={styles.assetsBtn} onClick={() => setShowAssets(true)}>
              View My Assets
            </button>
          </div>
        )}
      </main>

      <Leaderboard refreshTrigger={leaderboardTrigger} />
    </>
  );
}
