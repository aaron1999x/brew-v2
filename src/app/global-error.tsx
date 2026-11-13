'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { MESSAGE_FALLBACK } from '@/lib/errors/messages';
import '@/styles/tokens.css';
import '@/styles/base.css';

// Last-resort boundary: replaces the root layout, so it renders its own <html> and <body>.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorPanel title="Something went wrong" message={MESSAGE_FALLBACK} onRetry={retry} />
      </body>
    </html>
  );
}
