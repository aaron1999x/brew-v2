import type { Metadata } from 'next';
import { OfflinePanel } from './OfflinePanel';

// Precached by the service worker and shown when a page can't be loaded without a connection.
export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

export default function OfflinePage() {
  return <OfflinePanel />;
}
