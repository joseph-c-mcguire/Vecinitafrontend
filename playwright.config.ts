import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const port = Number(process.env.E2E_PORT || 4173);
const host = process.env.E2E_HOST || '127.0.0.1';
const baseURL = process.env.E2E_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_SKIP_WEBSERVER === 'true'
    ? undefined
    : {
        command: `npm run dev -- --host ${host} --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
