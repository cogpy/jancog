import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration for Jan App
 *
 * Covers:
 * - Desktop app (Tauri) testing
 * - Web app testing
 * - Cross-browser testing
 * - Mobile viewport testing
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for web app */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:1420',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'on-first-retry',
    /* Timeout for each action */
    actionTimeout: 10000,
    /* Timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Global timeout */
  timeout: 60000,
  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    /* Desktop browsers */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile viewports */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Branded browsers */
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Web server to run before tests */
  webServer: {
    command: 'yarn serve:web-app',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  /* Output folder for test artifacts */
  outputDir: 'test-results',
})
