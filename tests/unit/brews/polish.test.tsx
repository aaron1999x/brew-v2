import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoundPill } from '@/components/brews/timer/SoundPill';
import { TimerProgress } from '@/components/brews/timer/TimerProgress';
import { summaryRows } from '@/components/brews/timer/PrepScreen';
import { applyQuickChange, normalizeGrind, normalizeQuickChange } from '@/lib/brews/quick-change';
import { changeNote } from '@/lib/brews/change-note';
import { brewSessionSchema, quickChangeSchema } from '@/lib/brews/schema';
import { createSession, readSessions, writeSession, type StorageLike } from '@/lib/brews/sessions';
import { versionSchema } from '@/lib/recipes/schema';
import { formatTemp, formatWeight } from '@/lib/units';
import { METRIC, V60, V60_STEPS } from './fixtures';

const fmt = { weight: (g: number) => formatWeight(g, 'g'), temp: (c: number) => formatTemp(c, 'c') };

const sessionVersion = (over: Record<string, unknown> = {}) => ({
  dose_g: 16.5,
  brew_water_g: 170,
  bypass_g: 0,
  retention_ratio: null,
  temp_c: 92,
  grind_setting: '7.5',
  grind_microns: null,
  grinder: '1Zpresso K-Ultra',
  drawdown_min_s: null,
  drawdown_max_s: null,
  tds_min: null,
  tds_max: null,
  ey_min: null,
  ey_max: null,
  steps: V60_STEPS,
  ...over,
});

describe('the prep summary: two rows that never break inside an item', () => {
  it('row one is dose, water and ratio; row two is temperature, the grind setting and the grinder', () => {
    const v = sessionVersion();
    const [one, two] = summaryRows(v, v, new Set(), fmt);
    expect(one.map((i) => i.text)).toEqual(['16.5 g', '170 g', '1:10.3']);
    expect(two.map((i) => i.text)).toEqual(['92 °C', 'Grind 7.5', '1Zpresso K-Ultra']);
  });

  it('says the grind is not set, and still names the grinder', () => {
    const v = sessionVersion({ grind_setting: null });
    const [, two] = summaryRows(v, v, new Set(), fmt);
    expect(two.map((i) => i.text)).toEqual(['92 °C', 'Grind not set', '1Zpresso K-Ultra']);
  });

  it('adds the grind size in µm to the setting, or shows it alone', () => {
    const both = sessionVersion({ grind_microns: 650 });
    expect(summaryRows(both, both, new Set(), fmt)[1].map((i) => i.text)).toContain('Grind 7.5 (650 µm)');
    const only = sessionVersion({ grind_setting: null, grind_microns: 650 });
    expect(summaryRows(only, only, new Set(), fmt)[1].map((i) => i.text)).toContain('Grind 650 µm');
  });

  it('leaves out what the recipe does not have', () => {
    const v = sessionVersion({ temp_c: null, grind_setting: null, grinder: null });
    expect(summaryRows(v, v, new Set(), fmt)[1]).toEqual([]);
  });

  it('shows the version’s own value beside one changed for this brew', () => {
    const base = sessionVersion();
    const applied = applyQuickChange(base, { tempC: 94, grindSetting: '8' });
    const [, two] = summaryRows(applied, base, new Set(['temp', 'grind']), fmt);
    expect(two[0]).toEqual({ text: '94 °C', was: '92 °C' });
    expect(two[1]).toEqual({ text: 'Grind 8', was: '7.5' });
  });
});

describe('the Sound pill', () => {
  it('is a toggle button that says Sound on or Sound off', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<SoundPill on onToggle={onToggle} />);
    const on = screen.getByRole('button', { name: 'Sound on' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(on);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<SoundPill on={false} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks for a tap when sound is on but the browser has not started audio', async () => {
    const onToggle = vi.fn();
    const onEnable = vi.fn();
    render(<SoundPill on blocked onToggle={onToggle} onEnable={onEnable} />);
    const button = screen.getByRole('button', { name: 'Sound is off: tap to turn on' });
    expect(button).not.toHaveAttribute('aria-pressed');
    await userEvent.setup().click(button);
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not ask for a tap when the person turned sound off', () => {
    render(<SoundPill on={false} blocked onToggle={vi.fn()} onEnable={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sound off' })).toBeInTheDocument();
  });
});

describe('the progress bar under the clock', () => {
  it('is named "0:31 of 1:15" and has the numbers a progress bar needs', () => {
    render(<TimerProgress elapsedS={31.8} totalS={75} />);
    const bar = screen.getByRole('progressbar', { name: '0:31 of 1:15' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '75');
    expect(bar).toHaveAttribute('aria-valuenow', '31');
    expect(bar).toHaveAttribute('aria-valuetext', '0:31 of 1:15');
    expect(parseFloat((bar.firstElementChild as HTMLElement).style.width)).toBeCloseTo((31 / 75) * 100, 2);
  });

  it('stays between empty and full, and is not a live region', () => {
    const { rerender, container } = render(<TimerProgress elapsedS={-5} totalS={75} />);
    expect(screen.getByRole('progressbar', { name: '0:00 of 1:15' })).toHaveAttribute('aria-valuenow', '0');
    rerender(<TimerProgress elapsedS={200} totalS={75} />);
    expect(screen.getByRole('progressbar', { name: '1:15 of 1:15' })).toHaveAttribute('aria-valuenow', '75');
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('shows hours for a long steep', () => {
    render(<TimerProgress elapsedS={3725} totalS={43_260} />);
    expect(screen.getByRole('progressbar', { name: '1:02:05 of 12:01:00' })).toBeInTheDocument();
  });
});

describe('the grind setting is plain text, kept exactly as typed', () => {
  const settings = ['7.5', '2.5.0', '24 clicks', '18', '7,5', 'between 7 and 8'];

  it('the recipe form takes any text up to 40 characters and does not reformat it', () => {
    for (const setting of settings) {
      const parsed = versionSchema.safeParse({ dose_g: 15, brew_water_g: 250, grind_setting: setting });
      expect(parsed.success, setting).toBe(true);
      expect(parsed.data?.grind_setting, setting).toBe(setting);
    }
    expect(versionSchema.safeParse({ dose_g: 15, brew_water_g: 250, grind_setting: 'x'.repeat(40) }).success).toBe(true);
    expect(versionSchema.safeParse({ dose_g: 15, brew_water_g: 250, grind_setting: 'x'.repeat(41) }).success).toBe(false);
  });

  it('grind size in µm stays a whole number', () => {
    const parse = (g: unknown) =>
      versionSchema.safeParse({ dose_g: 15, brew_water_g: 250, grind_microns: g }).success;
    expect(parse(650)).toBe(true);
    expect(parse(650.5)).toBe(false);
  });

  it('the quick change schema keeps spaces and decimals as typed', () => {
    for (const setting of [...settings, '24 ', ' 7.5', '24 clicks ']) {
      const parsed = quickChangeSchema.safeParse({ grindSetting: setting });
      expect(parsed.success, setting).toBe(true);
      expect(parsed.data?.grindSetting, setting).toBe(setting);
    }
    expect(quickChangeSchema.safeParse({ grindSetting: 'x'.repeat(41) }).success).toBe(false);
  });

  it('a saved session gives back exactly what was typed, so typing a space between words works', () => {
    const data = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const userId = '11111111-1111-4111-8111-111111111111';
    for (const setting of ['7.5', '2.5.0', '24 clicks', '24 ', '24 c']) {
      const session = {
        ...createSession({
          userId,
          recipeId: 'r',
          versionId: 'v',
          versionNo: 1,
          latestVersionNo: 1,
          handle: 'a',
          slug: 's',
          recipeName: 'R',
          method: 'pour_over',
          entry: 'log',
          version: sessionVersion() as never,
        }),
        quickChange: { grindSetting: setting },
      };
      expect(brewSessionSchema.safeParse(session).success, setting).toBe(true);
      writeSession(userId, session, storage);
      const read = readSessions(userId, storage).find((x) => x.id === session.id);
      expect(read?.quickChange?.grindSetting, setting).toBe(setting);
    }
  });

  it('applies and describes a decimal setting without changing it', () => {
    const out = applyQuickChange({ ...V60, grind_setting: '7' }, { grindSetting: '7.5' });
    expect(out.grind_setting).toBe('7.5');
    expect(applyQuickChange(V60, { grindSetting: '2.5.0' }).grind_setting).toBe('2.5.0');
    expect(normalizeGrind(' 7.5 ')).toBe('7.5');
    expect(normalizeQuickChange({ ...V60, grind_setting: '7' }, { grindSetting: '7.5' })).toEqual({
      grindSetting: '7.5',
    });
    expect(changeNote({ ...V60, grind_setting: '7' }, { grindSetting: '7.5' }, METRIC)).toBe(
      'Brewed with changes: grind 7 → 7.5',
    );
  });
});
