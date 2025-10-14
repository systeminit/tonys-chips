import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Tony's World of Chips E2E tests
 *
 * Environment variables:
 * - API_URL: API base URL (default: http://localhost:3000)
 * - WEB_URL: Web base URL (default: http://localhost:8080)
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test timeout
  timeout: 30000,
  expect: {
    timeout: 5000
  },

  projects: [
    {
      name: 'api-tests',
      testMatch: /.*api\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'http://localhost:3000'
      },
    },
    {
      name: 'web-tests',
      testMatch: /.*web\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.WEB_URL || 'http://localhost:8080'
      },
    },
  ],
});
