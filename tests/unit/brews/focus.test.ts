import { describe, expect, it } from 'vitest';
import { countdownText, focusInfo, scaleWeightAt, type FocusFormat } from '@/lib/brews/focus';
import type { StepData } from '@/lib/recipes/steps';
import { formatClock, formatTemp, formatWeight } from '@/lib/units';
import { V60_STEPS } from './fixtures';

const fmt: FocusFormat = {
  weight: (g) => formatWeight(g, 'g'),
  temp: (c) => formatTemp(c, 'c'),
  duration: formatClock,
  at: formatClock,
};

/** The prototype-style recipe: a bloom at 65 °C, a swirl, two pours at 92 °C, a wait, a last pour. */
const VARIED: StepData[] = [
  { id: 'a', kind: 'pour', at_s: 0, target_g: 40, temp_c: 65, technique: 'Bloom' },
  { id: 'b', kind: 'wait', at_s: 5, duration_s: 30 },
  { id: 'c', kind: 'pour', at_s: 40, target_g: 100, temp_c: 92, technique: 'Centre spiral' },
  { id: 'd', kind: 'swirl', at_s: 105, duration_s: 5 },
  { id: 'e', kind: 'pour', at_s: 110, target_g: 250, temp_c: 92 },
];

describe('focusInfo: what the one card says', () => {
  it('says where the scale is and the kettle temperature when it varies by pour', () => {
    const info = focusInfo(VARIED, 2, 92, fmt);
    expect(info.status).toBe('On scale 40 g · kettle 65 °C');
  });

  it('leaves the kettle out when the temperature never varies', () => {
    const info = focusInfo(V60_STEPS.map((s) => ({ ...s, temp_c: null })), 2, 93, fmt);
    expect(info.status).toBe('On scale 30 g');
  });

  it('describes a wait with where the scale stays and the time left', () => {
    const info = focusInfo(VARIED, 20, 92, fmt);
    expect(info.status).toBe('Wait · scale stays at 40 g · 0:15 left');
  });

  it('stops counting down once a step’s own time has run out', () => {
    const info = focusInfo(VARIED, 37, 92, fmt);
    expect(info.status).toBe('Wait · scale stays at 40 g');
  });

  it('names the next pour with its technique, the target as the hero and the amount of this pour', () => {
    const info = focusInfo(VARIED, 20, 92, fmt);
    expect(info.nextLine).toBe('Next pour at 0:40 · Centre spiral');
    expect(info.hero).toEqual({ kind: 'weight', grams: 100 });
    expect(info.delta).toBe('+60 g this pour');
    expect(info.countdown).toBe('in 20 s');
  });

  it('tells you to switch the kettle when the next pour is at another temperature', () => {
    const info = focusInfo(VARIED, 20, 92, fmt);
    expect(info.kettle).toEqual({ text: 'Switch kettle → 92 °C', change: true });
  });

  it('shows the plain temperature when the next pour is at the temperature you are at', () => {
    const info = focusInfo(VARIED, 60, 92, fmt);
    expect(info.nextLine).toBe('Next: Swirl at 1:45');
    expect(info.kettle).toBeNull();
    const last = focusInfo(VARIED, 106, 92, fmt);
    expect(last.kettle).toEqual({ text: '92 °C', change: false });
  });

  it('puts the step name in the hero for a step that is not a pour', () => {
    const info = focusInfo(VARIED, 60, 92, fmt);
    expect(info.hero).toEqual({ kind: 'name', text: 'Swirl', detail: '0:05' });
    expect(info.delta).toBeNull();
    expect(info.countdown).toBe('in 45 s');
  });

  it('counts down in m:ss from a minute up', () => {
    expect(countdownText(45.2, formatClock)).toBe('in 46 s');
    expect(countdownText(59.01, formatClock)).toBe('in 1:00');
    expect(countdownText(125, formatClock)).toBe('in 2:05');
    expect(countdownText(-3, formatClock)).toBe('in 0 s');
  });

  it('uses the first step as next during the count-in, with nothing happening yet', () => {
    const info = focusInfo(VARIED, -3, 92, fmt);
    expect(info.status).toBeNull();
    expect(info.nextLine).toBe('Next pour at 0:00 · Bloom');
    expect(info.kettle).toEqual({ text: 'Switch kettle → 65 °C', change: true });
  });

  it('says the last pour is done after the last step', () => {
    const info = focusInfo(VARIED, 120, 92, fmt);
    expect(info.done).toEqual({ title: 'Last pour done' });
    expect(info.status).toBe('On scale 250 g · kettle 92 °C');
    expect(info.nextLine).toBeNull();
    expect(info.hero).toBeNull();
    expect(info.countdown).toBeNull();
  });

  it('says all steps are done when the last step is not a pour', () => {
    const steps: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 200 },
      { id: 'b', kind: 'press', at_s: 30, duration_s: 20 },
    ];
    expect(focusInfo(steps, 100, null, fmt).done).toEqual({ title: 'All steps done' });
  });

  it('shows clock times for a steep when asked', () => {
    const steep: StepData[] = [
      { id: 'a', kind: 'pour', at_s: 0, target_g: 600 },
      { id: 'b', kind: 'other', at_s: 43_200, label: 'Open valve' },
    ];
    const info = focusInfo(steep, 100, null, { ...fmt, at: (s) => `at ${s / 3600} h` });
    expect(info.nextLine).toBe('Next: Open valve at at 12 h');
    expect(info.status).toBe('On scale 600 g');
  });

  it('knows the scale weight at a step', () => {
    expect(scaleWeightAt(VARIED, 1)).toBe(40);
    expect(scaleWeightAt(VARIED, 3)).toBe(100);
    expect(scaleWeightAt([{ id: 'x', kind: 'other', at_s: 0, label: 'Close valve' }], 0)).toBeNull();
  });
});
