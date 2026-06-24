'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useState, useRef, useEffect } from 'react';
import { shortenAddress } from '@/lib/formatting';
import styles from './WalletButton.module.css';

interface WalletButtonProps {
  onOpenAssets?: () => void;
}

export default function WalletButton({ onOpenAssets }: WalletButtonProps) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!mounted || !isConnected) {
    return (
      <button
        className={styles.btn}
        onClick={() => connect({ connector: injected() })}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        className={styles.btnConnected}
        onClick={() => setOpen((o) => !o)}
      >
        {address ? shortenAddress(address) : 'Connected'}
      </button>
      {open && (
        <div className={styles.menu}>
          {onOpenAssets && (
            <button
              className={styles.menuItem}
              onClick={() => { onOpenAssets(); setOpen(false); }}
            >
              View Assets
            </button>
          )}
          <button
            className={styles.menuItem}
            onClick={() => { navigator.clipboard.writeText(address ?? ''); setOpen(false); }}
          >
            Copy Address
          </button>
          <button
            className={styles.menuItemDanger}
            onClick={() => { disconnect(); setOpen(false); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
