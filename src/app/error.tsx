'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { toUserMessage } from '@/lib/errors/messages';

// Route-level error boundary. In this Next.js version the props are `error: unknown` and `retry`.
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorPanel title="Something went wrong" message={toUserMessage(error)} onRetry={retry} />;
}
