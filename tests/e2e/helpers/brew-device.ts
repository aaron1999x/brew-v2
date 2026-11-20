import type { Page } from '@playwright/test';
import { expect, waitForApp, type TestUser } from './test-users';

declare global {
  interface Window {
    __beeps: number[];
    __wakeRequests: number;
  }
}

/** A bloom at 65 °C, a wait, two pours at 92 °C, a swirl and a last pour: the prototype's style of recipe. */
export const VARIED = {
  steps: [
    { id: 'a', kind: 'pour', at_s: 0, target_g: 40, temp_c: 65, technique: 'Bloom' },
    { id: 'b', kind: 'wait', at_s: 5, duration_s: 30 },
    { id: 'c', kind: 'pour', at_s: 40, target_g: 100, temp_c: 92, technique: 'Centre spiral' },
    { id: 'd', kind: 'swirl', at_s: 60, duration_s: 5 },
    { id: 'e', kind: 'pour', at_s: 70, target_g: 250, temp_c: 92 },
  ],
  temp_c: 92,
};

/** Counts every beep's frequency and every wake lock request (call before the page loads). */
export async function stubDevice(page: Page) {
  await page.addInitScript(() => {
    window.__beeps = [];
    window.__wakeRequests = 0;
    class FakeAudioContext {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      addEventListener() {}
      async resume() {
        this.state = 'running';
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return { connect() {}, start() {} };
      }
      createGain() {
        const node = {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect: () => node,
        };
        return node;
      }
      createOscillator() {
        const osc = {
          type: '',
          frequency: { value: 0 },
          connect: () => ({ connect() {} }),
          start() {
            window.__beeps.push(osc.frequency.value);
          },
          stop() {},
        };
        return osc;
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          window.__wakeRequests += 1;
          return { release: async () => {}, addEventListener() {} };
        },
      },
    });
  });
}

/** Opens the recipe's choice sheet and starts a guided timer; lands on the prep screen. */
export async function openPrep(page: Page, user: TestUser, slug: string) {
  await page.goto(`/@${user.handle}/${slug}?brew=1`);
  await waitForApp(page);
  const sheet = page.getByRole('dialog', { name: 'Brew this recipe' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Guided timer' }).click();
  await page.waitForURL('**/brew?session=*');
  await expect(page).toHaveTitle(/Brew/);
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
}

/** Freezes the fake clock a second from now, so the next action starts from a known moment. */
export async function pauseClockSoon(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** The brew clock's text, from the timer's `data-time` ("0:10", "1:02:05"). */
export const clockText = (page: Page) => page.getByRole('timer');

export async function expectClock(page: Page, time: string) {
  await expect(page.getByRole('timer')).toHaveAttribute('data-time', time);
}

/** Closes the "While you were away" summary that a long jump in time brings up. */
export async function dismissMissed(page: Page) {
  const dialog = page.getByRole('alertdialog', { name: 'While you were away' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
}
