import { expect, test } from '@playwright/test';

test.skip(
  process.env.PLAYWRIGHT_LIVE !== 'true',
  'Live production smoke is opt-in and must be run with PLAYWRIGHT_BASE_URL.'
);

test('Google-only production release exposes a usable login surface', async ({ page, request }) => {
  const liveBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  expect(liveBaseUrl).toBeTruthy();
  expect(new URL(liveBaseUrl!).protocol).toBe('https:');

  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', mode: 'production' });

  await page.goto('/login?next=%2Fadmin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hội Viên Beanbus Coffee');
  await expect(page.getByRole('button', { name: 'Nhận mã qua Zalo' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toBeEnabled();
});
