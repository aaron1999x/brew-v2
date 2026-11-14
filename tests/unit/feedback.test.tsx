import { act, render, renderHook, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { OfflineBanner } from '@/components/ui/OfflineBanner/OfflineBanner';
import { LoadingRegion } from '@/components/ui/Skeleton/Skeleton';
import { STILL_LOADING_MS, useStillLoading } from '@/components/ui/StillLoading/StillLoading';

describe('useStillLoading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('turns true only after the wait, and resets when loading ends', () => {
    const { result, rerender } = renderHook(({ loading }) => useStillLoading(loading), {
      initialProps: { loading: true },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(STILL_LOADING_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    rerender({ loading: false });
    expect(result.current).toBe(false);
    rerender({ loading: true });
    expect(result.current).toBe(false);
  });

  it('defaults to 10 seconds', () => {
    expect(STILL_LOADING_MS).toBe(10_000);
  });
});

describe('LoadingRegion', () => {
  it('is busy and announces one polite "Loading …" status', () => {
    const { container } = render(
      <LoadingRegion label="recipes">
        <span>skeleton</span>
      </LoadingRegion>,
    );
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading recipes');
  });
});

describe('OfflineBanner', () => {
  it('keeps its live region mounted and shows text only while offline', () => {
    const { rerender } = render(<OfflineBanner isOffline={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<OfflineBanner isOffline />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline.');
  });
});

describe('EmptyState', () => {
  it('has a heading, text and an action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No notices yet."
        text="Check back later."
        action={<button>Go</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No notices yet.' })).toBeInTheDocument();
    expect(screen.getByText('Check back later.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });
});

describe('FormErrorSummary', () => {
  it('renders nothing without errors', () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('takes focus, counts the errors and links each one to its field', () => {
    render(
      <>
        <FormErrorSummary
          errors={[
            { fieldId: 'a', message: 'Enter a name.' },
            { fieldId: 'b', message: 'Choose a method.' },
          ]}
        />
        <input id="a" aria-label="A" />
        <input id="b" aria-label="B" />
      </>,
    );
    const summary = screen.getByRole('group', { name: 'Fix 2 things to continue' });
    expect(summary).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Choose a method.' })).toHaveAttribute('href', '#b');
  });

  it('uses the singular for one error', () => {
    render(<FormErrorSummary errors={[{ fieldId: 'a', message: 'Enter a name.' }]} />);
    expect(screen.getByRole('group', { name: 'Fix 1 thing to continue' })).toBeInTheDocument();
  });
});
