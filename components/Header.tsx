'use client';

import styles from './Header.module.css';
import WalletButton from './WalletButton';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <svg className={styles.logoIcon} viewBox="0 0 28 28" fill="none" aria-hidden>
          <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="2" />
          <text x="14" y="19" textAnchor="middle" fontSize="13" fill="currentColor" fontFamily="monospace">P</text>
        </svg>
        Prints
      </div>

      <nav className={styles.nav}>
        <a
          className={styles.navLink}
          href="https://doge.nonfungible.tools"
          target="_blank"
          rel="noopener noreferrer"
        >
          Charts
        </a>
        <a
          className={styles.navLink}
          href="https://twitter.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Twitter
        </a>
        <a
          className={styles.navLink}
          href="https://discord.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </a>
      </nav>

      <div className={styles.right}>
        <WalletButton />
      </div>
    </header>
  );
}
