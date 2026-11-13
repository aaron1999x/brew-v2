import { ErrorPanel } from '@/components/feedback/ErrorPanel';

// Shared "not available" page. Private, hidden and missing things must all look exactly like this.
export default function NotFound() {
  return (
    <ErrorPanel
      title="This page isn't available"
      message="It may have been removed, made private, or never existed."
    />
  );
}
