import { describe, expect, it } from 'vitest';
import {
  createSession,
  getSession,
  nextVersionNo,
  readSessions,
  removeSession,
  sessionStage,
  sessionsKey,
  toSessionVersion,
  updateSession,
  withForm,
  withTimer,
  writeSession,
  type StorageLike,
} from '@/lib/brews/sessions';
import { reduce } from '@/lib/brews/timer';
import { V60_STEPS, methodSteps } from './fixtures';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const version = (steps = V60_STEPS) =>
  toSessionVersion(
    {
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
      steps,
    },
    'Comandante C40',
  );

const make = (overrides: Partial<Parameters<typeof createSession>[0]> = {}, now = 1000, id?: string) =>
  createSession(
    {
      userId: USER,
      recipeId: 'r1',
      versionId: 'v1',
      versionNo: 3,
      latestVersionNo: 3,
      handle: 'aaron',
      slug: 'v60-everyday',
      recipeName: 'V60 everyday',
      method: 'pour_over',
      entry: 'timer',
      version: version(),
      ...overrides,
    },
    now,
    id,
  );

describe('createSession', () => {
  it('gets its own brew id, which becomes brews.id', () => {
    const a = make();
    const b = make();
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
    expect(make({}, 1, '33333333-3333-4333-8333-333333333333').id).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('starts a timer in prep for the timer entry and none for log only', () => {
    const timer = make({ entry: 'timer' });
    expect(timer.timer?.phase).toBe('prep');
    expect(timer.timer?.mode).toBe('guided');
    expect(timer.form).toBeNull();
    expect(make({ entry: 'log' }).timer).toBeNull();
    expect(make({ version: version(methodSteps('cold_brew')) }).timer?.mode).toBe('steep');
    expect(make({ version: version([]) }).timer?.mode).toBe('stopwatch');
  });

  it('numbers a quick change after the latest version', () => {
    expect(nextVersionNo(make({ versionNo: 2, latestVersionNo: 4 }))).toBe(5);
  });
});

describe('storing sessions', () => {
  it('keeps them under a key per person, versioned', () => {
    expect(sessionsKey(USER)).toBe(`brew-sessions:v1:${USER}`);
    expect(sessionsKey(USER)).not.toBe(sessionsKey(OTHER));
  });

  it('round-trips a session exactly, steps included', () => {
    const storage = memoryStorage();
    const session = make({ quickChange: { grindSetting: '17', tempC: 94 } });
    expect(writeSession(USER, session, storage)).toBe(true);
    const [read] = readSessions(USER, storage);
    expect(read).toEqual(session);
    expect(read!.version.steps).toEqual(V60_STEPS);
    expect(getSession(USER, session.id, storage)).toEqual(session);
  });

  it('holds several sessions at once, newest first', () => {
    const storage = memoryStorage();
    const first = make({ recipeName: 'Cold brew' }, 1000);
    const second = make({ recipeName: 'V60' }, 2000);
    const third = make({ recipeName: 'Aeropress' }, 1500);
    [first, second, third].forEach((s) => writeSession(USER, s, storage));
    expect(readSessions(USER, storage).map((s) => s.recipeName)).toEqual(['V60', 'Aeropress', 'Cold brew']);
  });

  it('replaces a session with the same id instead of adding another', () => {
    const storage = memoryStorage();
    const session = make();
    writeSession(USER, session, storage);
    writeSession(USER, withForm(session, { overall: 8, notes: 'Sweet' }), storage);
    const all = readSessions(USER, storage);
    expect(all).toHaveLength(1);
    expect(all[0]!.form).toEqual({ overall: 8, notes: 'Sweet' });
  });

  it('keeps people apart', () => {
    const storage = memoryStorage();
    writeSession(USER, make(), storage);
    expect(readSessions(OTHER, storage)).toEqual([]);
    // A session copied under another person's key is never shown to them.
    storage.setItem(sessionsKey(OTHER), storage.getItem(sessionsKey(USER))!);
    expect(readSessions(OTHER, storage)).toEqual([]);
    expect(readSessions(USER, storage)).toHaveLength(1);
  });

  it('removes only the one session', () => {
    const storage = memoryStorage();
    const a = make({}, 1);
    const b = make({}, 2);
    writeSession(USER, a, storage);
    writeSession(USER, b, storage);
    expect(removeSession(USER, a.id, storage)).toBe(true);
    expect(readSessions(USER, storage).map((s) => s.id)).toEqual([b.id]);
    expect(removeSession(USER, 'nope', storage)).toBe(true);
    expect(readSessions(USER, storage)).toHaveLength(1);
  });

  it('updates a session in place and says when it is gone', () => {
    const storage = memoryStorage();
    const session = make();
    writeSession(USER, session, storage);
    const updated = updateSession(
      USER,
      session.id,
      (s) => withTimer(s, reduce(s.timer!, { type: 'START', now: 5000 })),
      storage,
    );
    expect(updated?.timer?.phase).toBe('countin');
    expect(getSession(USER, session.id, storage)?.timer?.countinStartedAt).toBe(5000);
    expect(updateSession(USER, 'missing', (s) => s, storage)).toBeNull();
  });
});

describe('bad storage', () => {
  it('ignores corrupt JSON', () => {
    const storage = memoryStorage({ [sessionsKey(USER)]: '{not json' });
    expect(readSessions(USER, storage)).toEqual([]);
    // and a later save starts clean
    expect(writeSession(USER, make(), storage)).toBe(true);
    expect(readSessions(USER, storage)).toHaveLength(1);
  });

  it('ignores a value that is not a list', () => {
    expect(readSessions(USER, memoryStorage({ [sessionsKey(USER)]: '{"a":1}' }))).toEqual([]);
    expect(readSessions(USER, memoryStorage({ [sessionsKey(USER)]: 'null' }))).toEqual([]);
  });

  it('skips an invalid entry and keeps the valid ones', () => {
    const good = make();
    const raw = JSON.stringify([{ v: 1, id: 'x' }, good, 'text', null, { ...good, v: 2 }]);
    const storage = memoryStorage({ [sessionsKey(USER)]: raw });
    expect(readSessions(USER, storage).map((s) => s.id)).toEqual([good.id]);
  });

  it('skips a duplicate id', () => {
    const good = make();
    const storage = memoryStorage({ [sessionsKey(USER)]: JSON.stringify([good, good]) });
    expect(readSessions(USER, storage)).toHaveLength(1);
  });

  it('drops a bad value inside a saved draft but keeps the rest', () => {
    const session = make();
    const raw = JSON.stringify([{ ...session, form: { overall: 'eight', notes: 'Sweet', flavours: ['peach'] } }]);
    const [read] = readSessions(USER, memoryStorage({ [sessionsKey(USER)]: raw }));
    expect(read!.form?.overall).toBeUndefined();
    expect(read!.form?.notes).toBe('Sweet');
    expect(read!.form?.flavours).toEqual(['peach']);
  });

  it('copes with storage that throws or is missing', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readSessions(USER, broken)).toEqual([]);
    expect(writeSession(USER, make(), broken)).toBe(false);
    expect(readSessions(USER, null)).toEqual([]);
    expect(writeSession(USER, make(), null)).toBe(false);
  });
});

describe('sessionStage', () => {
  it('describes where a session stands, for the cards on Home', () => {
    const guided = make();
    expect(sessionStage(guided)).toBe('preparing');
    const brewing = withTimer(guided, reduce(guided.timer!, { type: 'START', now: 1 }));
    expect(sessionStage(brewing)).toBe('brewing');
    const finished = withTimer(
      guided,
      reduce(reduce(reduce(guided.timer!, { type: 'START', now: 1 }), { type: 'TICK', now: 6000 }), {
        type: 'LOG_ANYWAY',
        now: 9000,
      }),
    );
    expect(sessionStage(finished)).toBe('logging');
    expect(sessionStage(make({ entry: 'log' }))).toBe('logging');
  });

  it('calls a running long steep steeping', () => {
    const steep = make({ version: version(methodSteps('cold_brew')) });
    expect(sessionStage(steep)).toBe('preparing');
    expect(sessionStage(withTimer(steep, reduce(steep.timer!, { type: 'START', now: 1 })))).toBe('steeping');
  });
});
