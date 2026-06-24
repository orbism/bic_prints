'use client';

import { useEffect, useState, useCallback } from 'react';
import { shortenAddress } from '@/lib/formatting';
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';
import styles from './Leaderboard.module.css';

type Tab = 'fdp' | 'adp';

function fmtCooldown(s: number): string {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? (rem > 0 ? `${m}m ${rem}s` : `${m}m`) : `${s}s`;
}

interface LeaderboardProps {
  refreshTrigger?: number;
}

export default function Leaderboard({ refreshTrigger }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [tab, setTab] = useState<Tab>('fdp');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fetchLeaderboard = useCallback(async (force = false) => {
    const url = force ? '/api/leaderboard?force=1' : '/api/leaderboard';
    if (force) { setRefreshing(true); setCooldown(20 * 60); } else setLoading(true);
    setError(null);
    try {
      const r = await fetch(url);
      const data = await r.json();
      if (Array.isArray(data)) {
        setEntries(data);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch {
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) fetchLeaderboard(false);
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabEntries = entries
    .filter((e) => tab === 'fdp' ? e.fdp > 0 : e.adp > 0)
    .sort((a, b) => tab === 'fdp' ? b.fdp - a.fdp : b.adp - a.adp);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? tabEntries.filter((e) =>
        e.address.toLowerCase().includes(query) ||
        (e.ensName?.toLowerCase().includes(query) ?? false)
      )
    : tabEntries;

  const displayName = (entry: LeaderboardEntry) =>
    entry.ensName ?? shortenAddress(entry.address);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Leaderboard</h2>
        <button
          className={styles.refreshBtn}
          onClick={() => fetchLeaderboard(true)}
          disabled={refreshing || cooldown > 0}
        >
          {refreshing ? 'Refreshing…' : cooldown > 0 ? `Refresh (${fmtCooldown(cooldown)})` : 'Refresh'}
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'fdp' ? styles.tabActive : ''}`}
          onClick={() => setTab('fdp')}
        >
          Feisty
        </button>
        <button
          className={`${styles.tab} ${tab === 'adp' ? styles.tabActive : ''}`}
          onClick={() => setTab('adp')}
        >
          Angry
        </button>
      </div>

      <input
        className={styles.search}
        type="text"
        placeholder="Search by address or ENS…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className={styles.errorMsg}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {search
            ? 'No results.'
            : entries.length === 0
              ? 'No data yet — click Refresh to sync from Etherscan.'
              : `No ${tab === 'fdp' ? 'Feisty' : 'Angry'} Print holders found.`}
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.rank}`}>#</th>
              <th className={styles.th}>Wallet</th>
              <th className={styles.th}>{tab === 'fdp' ? 'FDP' : 'ADP'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((entry, i) => (
              <tr key={entry.address} className={styles.tr}>
                <td className={`${styles.td} ${styles.rank}`}>{i + 1}</td>
                <td className={`${styles.td} ${styles.address}`}>
                  <a
                    href={`https://etherscan.io/address/${entry.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {displayName(entry)}
                  </a>
                </td>
                <td className={styles.td}>
                  <span className={styles.badge}>
                    {tab === 'fdp' ? entry.fdp : entry.adp}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
