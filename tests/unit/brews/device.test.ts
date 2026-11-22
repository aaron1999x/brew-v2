import { describe, expect, it } from 'vitest';
import { missedStepText, spokenWeight, stepAnnouncement, stepKindName } from '@/lib/brews/describe';
import { timerEventProps } from '@/lib/brews/events';
import { brewChoicePath, brewLogPath, brewTimerPath } from '@/lib/brews/paths';
import { DEFAULT_PREFS, PREFS_KEY, readPrefs, writePrefs } from '@/lib/brews/prefs';
import { createSession, type StorageLike } from '@/lib/brews/sessions';
import { newSessionInput } from '@/lib/brews/start';
import { brewCountText, summariseByRecipe } from '@/lib/brews/stats';
import type { RecipeWithVersion, VersionRow } from '@/lib/recipes/fetch';
import { formatClock, formatWeight } from '@/lib/units';
import { V60_STEPS } from './fixtures';

const memory = (initial: Record<string, string> = {}): StorageLike => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

describe('describing steps', () => {
  it('names a step by its kind, or by the label of an "other" step', () => {
    expect(stepKindName({ kind: 'swirl' })).toBe('Swirl');
    expect(stepKindName({ kind: 'other', label: ' Open valve ' })).toBe('Open valve');
    expect(stepKindName({ kind: 'other', label: '' })).toBe('Other');
  });

  it('speaks weights in the unit the person uses', () => {
    expect(spokenWeight(150, 'g')).toBe('150 grams');
    expect(spokenWeight(1, 'g')).toBe('1 gram');
    expect(spokenWeight(150, 'oz')).toBe('5.29 ounces');
  });

  it('announces the step that has started', () => {
    expect(stepAnnouncement(V60_STEPS, 2, 'g')).toBe('Step 3, pour to 100 grams');
    expect(stepAnnouncement(V60_STEPS, 1, 'g')).toBe('Step 2, swirl');
    expect(stepAnnouncement(V60_STEPS, 9, 'g')).toBe('');
    expect(
      stepAnnouncement([{ id: 'a', kind: 'other', at_s: 0, label: 'Close valve' }], 0, 'g'),
    ).toBe('Step 1, close valve');
  });

  it('writes the missed-step lines of the summary', () => {
    const w = (g: number) => formatWeight(g, 'g');
    expect(missedStepText(V60_STEPS[2]!, w, formatClock)).toBe('Pour to 100 g at 0:45');
    expect(missedStepText(V60_STEPS[4]!, w, formatClock)).toBe('Swirl at 1:40');
  });
});

describe('timer switches kept on the device', () => {
  it('start on, and survive a round trip', () => {
    const storage = memory();
    expect(readPrefs(storage)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ sound: true, vibration: true });
    expect(writePrefs({ sound: false, vibration: true }, storage)).toBe(true);
    expect(readPrefs(storage)).toEqual({ sound: false, vibration: true });
  });

  it('fall back to on for anything unreadable', () => {
    expect(readPrefs(memory({ [PREFS_KEY]: '{oops' }))).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memory({ [PREFS_KEY]: '[]' }))).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memory({ [PREFS_KEY]: '{"sound":"no","vibration":false}' }))).toEqual({
      sound: true,
      vibration: false,
    });
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(writePrefs(DEFAULT_PREFS, null)).toBe(false);
  });
});

describe('timer events', () => {
  const base = {
    userId: '11111111-1111-4111-8111-111111111111',
    recipeId: 'r1',
    versionId: 'v1',
    versionNo: 3,
    latestVersionNo: 3,
    handle: 'aaron',
    slug: 'v60',
    recipeName: 'Secret blend notes',
    method: 'pour_over' as const,
    entry: 'timer' as const,
    version: {
      dose_g: 15,
      brew_water_g: 250,
      bypass_g: 0,
      retention_ratio: null,
      temp_c: 93,
      grind_setting: '18',
      grinder: 'My private grinder',
      drawdown_min_s: null,
      drawdown_max_s: null,
      tds_min: null,
      tds_max: null,
      ey_min: null,
      ey_max: null,
      steps: V60_STEPS,
    },
  };

  it('say only the method, step count, steep and quick change', () => {
    const session = createSession(base);
    expect(timerEventProps(session)).toEqual({
      method: 'pour_over',
      step_count: 6,
      steep: false,
      quick_change: false,
    });
    expect(timerEventProps({ ...session, quickChange: { tempC: 94 } }, { early: true })).toEqual({
      method: 'pour_over',
      step_count: 6,
      steep: false,
      quick_change: true,
      early: true,
    });
  });

  it('carry nothing personal', () => {
    const text = JSON.stringify(timerEventProps(createSession(base)));
    for (const secret of ['Secret', 'grinder', 'aaron', '11111111', 'r1', 'v60']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('starting a session from a recipe', () => {
  it('copies what the timer and log need, grinder name included', () => {
    const version = {
      id: 'v-2',
      version_no: 2,
      dose_g: 15,
      brew_water_g: 250,
      bypass_g: 0,
      retention_ratio: null,
      temp_c: 93,
      grind_setting: '18',
      drawdown_min_s: 165,
      drawdown_max_s: 195,
      tds_min: 1.3,
      tds_max: 1.5,
      ey_min: 19,
      ey_max: 21,
      steps: V60_STEPS,
      gear: { grinder: { name: 'Comandante C40' } },
    } as unknown as VersionRow;
    const data = {
      recipe: { id: 'r1', slug: 'v60-everyday', name: 'V60 everyday', method: 'pour_over' },
      owner: { id: 'u1', handle: 'aaron' },
      version: { version_no: 4 },
    } as unknown as RecipeWithVersion;

    const input = newSessionInput(data, version, 'u1', 'timer');
    expect(input).toMatchObject({
      userId: 'u1',
      recipeId: 'r1',
      versionId: 'v-2',
      versionNo: 2,
      latestVersionNo: 4,
      handle: 'aaron',
      slug: 'v60-everyday',
      recipeName: 'V60 everyday',
      method: 'pour_over',
      entry: 'timer',
    });
    expect(input.version.grinder).toBe('Comandante C40');
    expect(input.version.tds_max).toBe(1.5);
    expect(createSession(input).latestVersionNo).toBe(4);
  });
});

describe('brew paths', () => {
  it('build the timer, choice sheet and log links', () => {
    expect(brewTimerPath('aaron', 'v60', 3, 'abc-123')).toBe('/@aaron/v60/v/3/brew?session=abc-123');
    expect(brewChoicePath('aaron', 'v60', 3)).toBe('/@aaron/v60/v/3?brew=1');
    expect(brewChoicePath('aaron', 'v60')).toBe('/@aaron/v60?brew=1');
    expect(brewLogPath('abc-123')).toBe('/brews/new?session=abc-123');
  });
});

describe('brew counts', () => {
  it('sum the versions of a recipe and keep the latest brew date', () => {
    const rows = [
      { recipe_id: 'r1', recipe_version_id: 'v1', brew_count: 2, last_brewed_at: '2026-11-10T08:00:00Z' },
      { recipe_id: 'r1', recipe_version_id: 'v2', brew_count: 1, last_brewed_at: '2026-11-18T08:00:00Z' },
      { recipe_id: 'r2', recipe_version_id: 'v9', brew_count: 4, last_brewed_at: '2026-11-01T08:00:00Z' },
    ];
    const by = summariseByRecipe(rows);
    expect(by.get('r1')).toEqual({ count: 3, lastBrewedAt: '2026-11-18T08:00:00Z' });
    expect(by.get('r2')).toEqual({ count: 4, lastBrewedAt: '2026-11-01T08:00:00Z' });
    expect(by.get('nope')).toBeUndefined();
    // Order of the rows doesn't matter.
    expect(summariseByRecipe([...rows].reverse()).get('r1')).toEqual(by.get('r1'));
  });

  it('reads as "Brewed 4×" or "Not brewed yet"', () => {
    expect(brewCountText(4)).toBe('Brewed 4×');
    expect(brewCountText(0)).toBe('Not brewed yet');
    expect(brewCountText(undefined)).toBe('Not brewed yet');
  });
});
