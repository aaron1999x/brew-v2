import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

/** One short entry per failing element, so a failure is readable at a glance. */
function summarise(violations: Violations): string[] {
  return violations.flatMap((v) =>
    v.nodes.map((n) => {
      const detail = (n.failureSummary ?? '').split('\n').slice(0, 3).join(' ').trim();
      return `${v.id} [${v.impact}] ${n.target.join(' ')} — ${detail} — ${n.html.slice(0, 180)}`;
    }),
  );
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    // React Aria's visually hidden live announcer copies a pending button's spinner (an unlabelled
    // role=img) into itself after a client-side navigation. It is not page content.
    .exclude('[data-live-announcer]')
    .analyze();
  expect(summarise(results.violations)).toEqual([]);
}
