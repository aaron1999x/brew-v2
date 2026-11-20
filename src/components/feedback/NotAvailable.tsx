import { ErrorPanel } from '@/components/feedback/ErrorPanel';

/**
 * The one "not available" page. Private, hidden, deleted and missing recipes and profiles must all
 * look exactly like this (docs/phase-2-ia-flows.md, URL rules), so nothing else may differ.
 */
export function NotAvailable() {
  return (
    <ErrorPanel
      title="This page isn't available"
      message="It may have been removed, made private, or never existed."
    />
  );
}
