'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { toast } from '@/components/ui/Toast/toast';
import { MESSAGE_FALLBACK, MESSAGE_LOGIN_AGAIN } from '@/lib/errors/messages';

/** Fetches /api/export and saves the JSON, so a failure shows a message instead of a broken download. */
export function DownloadData() {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const response = await fetch('/api/export', { cache: 'no-store' });
      if (!response.ok) {
        toast.error(response.status === 401 ? MESSAGE_LOGIN_AGAIN : MESSAGE_FALLBACK, {
          onRetry: () => void download(),
        });
        return;
      }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(
        response.headers.get('Content-Disposition') ?? '',
      )?.[1];
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name ?? 'brew-data.json';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Your data was downloaded.');
    } catch {
      toast.error(MESSAGE_FALLBACK, { onRetry: () => void download() });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" isPending={pending} pendingLabel="Preparing…" onPress={download}>
        Download my data
      </Button>
    </div>
  );
}
