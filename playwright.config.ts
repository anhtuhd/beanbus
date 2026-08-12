import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3101';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const devBundler = process.env.PLAYWRIGHT_USE_WEBPACK === 'true' ? '--webpack ' : '';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(useExternalServer ? {} : {
    webServer: {
      command: `npm run dev -- ${devBundler}--hostname 127.0.0.1 --port ${port}`,
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
  }),
});
