'use client';

import { ErrorPanel } from '@/components/feedback/ErrorPanel';

export function OfflinePanel() {
  return (
    <ErrorPanel
      title="You're offline"
      message="This page needs a connection. Check your signal, then try again."
      onRetry={() => window.location.reload()}
      showHomeLink={false}
    />
  );
}
