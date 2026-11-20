import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepData } from '@/lib/recipes/steps';

const toastUndo = vi.fn<(message: string, onUndo: () => void) => void>();
vi.mock('@/components/ui/Toast/toast', () => ({
  toast: { undo: (m: string, f: () => void) => toastUndo(m, f), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/settings/useSettings', async () => {
  const { formatClock } = await import('@/lib/units');
  return {
    useUnits: () => ({
      units: { temp_unit: 'c', weight_unit: 'g' },
      weight: (g: number) => `${g} g`,
      temp: (c: number) => `${c} °C`,
      duration: formatClock,
    }),
  };
});

const { StepsEditor } = await import('@/components/recipes/editor/StepsEditor');

const CONTEXT = { dose_g: 15, brew_water_g: 250 };

function Harness({
  initial = [] as StepData[],
  onSteps,
  vary = false,
}: {
  initial?: StepData[];
  onSteps?: (s: StepData[]) => void;
  vary?: boolean;
}) {
  const [steps, setSteps] = useState(initial);
  return (
    <StepsEditor
      steps={steps}
      onChange={(next) => {
        setSteps(next);
        onSteps?.(next);
      }}
      varyTemp={vary}
      context={CONTEXT}
      errors={{}}
    />
  );
}

const headings = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

beforeEach(() => toastUndo.mockClear());

describe('StepsEditor', () => {
  it('adds each kind of step with sensible defaults, in order', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const name of ['Pour', 'Swirl', 'Wait', 'Pour', 'Press', 'Other']) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(headings().filter((h) => h?.startsWith('Step'))).toEqual([
      'Step 1 · Pour · 0:00',
      'Step 2 · Swirl · 0:30',
      'Step 3 · Wait · 0:35',
      'Step 4 · Pour · 1:05',
      'Step 5 · Press · 1:35',
      'Step 6 · Other · 2:05',
    ]);
  });

  it('moves focus to the new step\'s time field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Pour' }));
    expect(screen.getByRole('textbox', { name: /Time/ })).toHaveFocus();
  });

  it('shows how much each pour adds', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'pour', at_s: 0, target_g: 30 },
          { id: 'b', kind: 'pour', at_s: 45, target_g: 150 },
        ]}
      />,
    );
    expect(screen.getByText('+30 g this pour')).toBeInTheDocument();
    expect(screen.getByText('+120 g this pour')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete step 1' }));
    expect(screen.getByText('+150 g this pour')).toBeInTheDocument();
  });

  it('shows long times as h:mm:ss and totals them', () => {
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'pour', at_s: 0, target_g: 250 },
          { id: 'b', kind: 'wait', at_s: 60, duration_s: 43_200 },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Step 2 · Wait · 1:00' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:00:00')).toBeInTheDocument();
    expect(screen.getByText('12:01:00')).toBeInTheDocument();
  });

  it('warns, without blocking, when the last pour is not the brew water', () => {
    render(<Harness initial={[{ id: 'a', kind: 'pour', at_s: 0, target_g: 240 }]} />);
    expect(screen.getByText('Your last pour reaches 240 g; brew water is 250 g')).toBeInTheDocument();
  });

  it('moves a step and keeps focus on the button that was used', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'wait', at_s: 0, duration_s: 10 },
          { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
          { id: 'c', kind: 'press', at_s: 15, duration_s: 5 },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));
    expect(headings().filter((h) => h?.startsWith('Step'))[0]).toContain('Swirl');
    // The step moved to position 2, so the same step's "down" button is now "Move step 2 down".
    expect(screen.getByRole('button', { name: 'Move step 2 down' })).toHaveFocus();
  });

  it('puts focus on the other button when a step reaches the end of the list', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'wait', at_s: 0, duration_s: 10 },
          { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Move step 1 down' }));
    expect(screen.getByRole('button', { name: 'Move step 2 up' })).toHaveFocus();
  });

  it('deletes a step and puts it back with Undo', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'wait', at_s: 0, duration_s: 10 },
          { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete step 1' }));
    expect(headings().filter((h) => h?.startsWith('Step'))).toEqual(['Step 1 · Swirl · 0:10']);
    expect(toastUndo).toHaveBeenCalledWith('Deleted wait', expect.any(Function));
    // Focus lands on the step that took its place, not on nothing.
    expect(screen.getByRole('heading', { name: 'Step 1 · Swirl · 0:10' })).toHaveFocus();

    const undo = toastUndo.mock.calls[0]![1];
    act(() => undo());
    expect(headings().filter((h) => h?.startsWith('Step'))).toEqual([
      'Step 1 · Wait · 0:00',
      'Step 2 · Swirl · 0:10',
    ]);
  });

  it('shows a pour’s temperature field only while "Vary temperature by pour" (in the Numbers section) is on', () => {
    const initial: StepData[] = [{ id: 'a', kind: 'pour', at_s: 0, target_g: 250, temp_c: 93 }];
    const { rerender } = render(<Harness initial={initial} />);
    const group = screen.getByRole('group', { name: 'Step 1, pour, 0:00' });
    expect(within(group).queryByLabelText(/Temperature/)).toBeNull();
    // The switch itself no longer lives in this list.
    expect(screen.queryByText('Vary temperature by pour')).toBeNull();
    rerender(<Harness initial={initial} vary />);
    expect(within(screen.getByRole('group', { name: 'Step 1, pour, 0:00' })).getByLabelText(/Temperature/)).toBeInTheDocument();
  });

  it('offers to sort steps that are out of order', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'a', kind: 'wait', at_s: 60, duration_s: 10 },
          { id: 'b', kind: 'swirl', at_s: 10, duration_s: 5 },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Sort steps by time' }));
    expect(headings().filter((h) => h?.startsWith('Step'))).toEqual([
      'Step 1 · Swirl · 0:10',
      'Step 2 · Wait · 1:00',
    ]);
  });

  it('says what an empty list means', () => {
    render(<Harness />);
    expect(screen.getByText(/simple stopwatch/)).toBeInTheDocument();
  });
});
