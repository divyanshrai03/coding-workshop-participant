import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

/**
 * Playwright configuration for the ACME Projects QA suite.
 *
 * Project layout (see TESTING_PLAN.md §2/§12 for the app this targets):
 *   - chromium/firefox/webkit -> tests/ui        (cross-browser UI automation, Phase 3)
 *   - api                     -> tests/api       (request-only, no browser, Phase 4)
 *   - integration             -> tests/integration (mixed UI+API workflows, Phase 6)
 *
 * tests/smoke and tests/regression (Phase 8) are not separate projects - they
 * are curated subsets of the specs above, selected by tag (`--grep @smoke`),
 * matching the "reuse existing tests, don't duplicate them" requirement.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './reports/test-results',

  fullyParallel: true,
  forbidOnly: env.IS_CI,
  retries: env.IS_CI ? 2 : 0,
  workers: env.IS_CI ? 2 : undefined,

  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html-report', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ...(env.IS_CI ? ([['github']] as const) : []),
  ],

  use: {
    baseURL: env.UI_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testDir: './tests/ui',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testDir: './tests/ui',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: env.API_BASE_URL,
        // API-only project: no browser context is launched for these tests.
      },
    },
    {
      name: 'integration',
      testDir: './tests/integration',
      use: { ...devices['Desktop Chrome'], baseURL: env.UI_BASE_URL },
    },
  ],
});
