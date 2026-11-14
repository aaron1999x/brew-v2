'use client';

import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './OfflineBanner.module.css';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Browser connectivity. Assumes online on the server and during hydration. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Shown only while offline. It is a polite status that appears when the connection drops, so it
 * is announced once and not again while it stays.
 */
export function OfflineBanner({ isOffline }: { isOffline: boolean }) {
  // Keep the live region mounted so a screen reader sees the text being added, then removed.
  return (
    <div role="status" className={isOffline ? styles.wrap : undefined}>
      {isOffline ? (
        <p className={styles.banner}>
          <Icon icon={WifiOff} size="md" />
          <span>Offline. Brews save on this device and sync when you&apos;re back.</span>
        </p>
      ) : null}
    </div>
  );
}

/** The banner wired to the browser's online/offline events. */
export function ConnectedOfflineBanner() {
  const isOnline = useOnlineStatus();
  return <OfflineBanner isOffline={!isOnline} />;
}
