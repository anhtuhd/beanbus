import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3101';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE ?? 'demo',
      NEXT_PUBLIC_ENABLE_SEPAY: process.env.NEXT_PUBLIC_ENABLE_SEPAY ?? 'false',
    },
  },
});
