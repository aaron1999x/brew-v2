import { defineConfig, devices } from '@playwright/test';

// Tests run against a PRODUCTION build (`npm run build` first): the service worker is only
// registered in production builds. Playwright starts and stops `next start` itself.
const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: 'tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // The service-worker spec depends on timing (worker install, cache fill, going offline), so it
  // runs on its own after everything else has finished, one browser at a time, instead of
  // competing with the parallel suite for CPU. This is isolation, not retries.
  projects: [
    { name: 'iphone', testIgnore: /offline\.spec/, use: { ...devices['iPhone 15'] } },
    { name: 'desktop', testIgnore: /offline\.spec/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'iphone-offline',
      testMatch: /offline\.spec/,
      dependencies: ['iphone', 'desktop'],
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'desktop-offline',
      testMatch: /offline\.spec/,
      dependencies: ['iphone-offline'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
