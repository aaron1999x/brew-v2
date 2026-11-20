import { afterEach, describe, expect, it, vi } from 'vitest';
import { TONES, VIBRATION, beepsFor } from '@/lib/brews/audio';

describe('timer tones (ported from the prototype)', () => {
  it('has the prototype frequencies, lengths and volumes', () => {
    expect(TONES).toEqual({
      tick: { freq: 880, ms: 90, times: 1, vol: 0.4 },
      warn: { freq: 660, ms: 120, times: 1, vol: 0.4 },
      go: { freq: 990, ms: 160, times: 2, vol: 0.4 },
      'soft-warn': { freq: 1480, ms: 55, times: 1, vol: 0.12 },
      'soft-go': { freq: 1480, ms: 70, times: 1, vol: 0.16 },
    });
  });

  it('has the prototype vibration patterns', () => {
    expect(VIBRATION).toEqual({
      tick: 60,
      warn: 150,
      go: [200, 80, 200],
      'soft-warn': 35,
      'soft-go': 50,
    });
  });

  it('plays a pour beep twice, 80 ms apart', () => {
    const [a, b] = beepsFor('go', 10);
    expect(a).toEqual({ startS: 10, endS: 10.16, freq: 990, vol: 0.4 });
    expect(b!.startS).toBeCloseTo(10.24, 10);
    expect(b!.endS).toBeCloseTo(10.4, 10);
    expect(beepsFor('go')).toHaveLength(2);
  });

  it('plays a soft pip once and quietly', () => {
    expect(beepsFor('soft-go', 1)).toEqual([{ startS: 1, endS: 1.07, freq: 1480, vol: 0.16 }]);
    expect(beepsFor('soft-warn')[0]!.vol).toBe(0.12);
  });
});

describe('audio on a device', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('says audio is unavailable when the browser has no Web Audio, and never throws', async () => {
    vi.resetModules();
    const audio = await import('@/lib/brews/audio');
    expect(audio.getAudioStatus()).toBe('idle');
    expect(await audio.unlockAudio()).toBe('unavailable');
    expect(audio.playCueSound('go')).toBe(false);
  });

  it('unlocks on a tap and then plays each cue with its beeps', async () => {
    const oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn> }[] = [];
    class FakeContext {
      state = 'suspended';
      currentTime = 5;
      destination = {};
      addEventListener() {}
      async resume() {
        this.state = 'running';
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return { connect: vi.fn(), start: vi.fn(), buffer: null };
      }
      createGain() {
        const node = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(() => node),
        };
        return node;
      }
      createOscillator() {
        const gainChain = { connect: vi.fn() };
        const osc = {
          type: '',
          frequency: { value: 0 },
          connect: vi.fn(() => gainChain),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(osc);
        return osc;
      }
    }
    vi.stubGlobal('AudioContext', FakeContext);
    Object.defineProperty(window, 'AudioContext', { value: FakeContext, configurable: true });

    vi.resetModules();
    const audio = await import('@/lib/brews/audio');
    expect(audio.playCueSound('go')).toBe(false); // nothing plays before the tap
    expect(await audio.unlockAudio()).toBe('running');
    expect(audio.getAudioStatus()).toBe('running');

    expect(audio.playCueSound('go')).toBe(true);
    expect(oscillators).toHaveLength(2);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([990, 990]);
    expect(oscillators[0]!.start).toHaveBeenCalledWith(5);

    audio.playCueSound('soft-go');
    expect(oscillators).toHaveLength(3);
    expect(oscillators[2]!.frequency.value).toBe(1480);
    Reflect.deleteProperty(window, 'AudioContext');
  });

  it('vibrates only where the browser can', async () => {
    vi.resetModules();
    const audio = await import('@/lib/brews/audio');
    expect(audio.canVibrate()).toBe(false);
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(audio.canVibrate()).toBe(true);
    audio.vibrateCue('go');
    expect(vibrate).toHaveBeenCalledWith([200, 80, 200]);
    Reflect.deleteProperty(navigator, 'vibrate');
  });
});
