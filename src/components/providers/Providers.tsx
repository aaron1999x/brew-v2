'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState, type ReactNode } from 'react';
import { makeQueryClient } from '@/lib/query/client';

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; useState keeps it stable across re-renders.
  const [queryClient] = useState(makeQueryClient);

  // Marks the document once React is interactive; end-to-end tests wait for it before typing.
  useEffect(() => {
    document.documentElement.dataset.appReady = 'true';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools render nothing in production builds. */}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
