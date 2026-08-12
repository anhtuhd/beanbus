import { expect, test } from '@playwright/test';

test('stored-value routes remain safely disabled in demo mode', async ({ page }) => {
  await page.goto('/account/topup');
  await expect(page.getByText('Chức năng chưa được kích hoạt')).toBeVisible();

  await page.goto('/flash-sale');
  await expect(page.getByText('Chức năng chưa được kích hoạt')).toBeVisible();
});

test('production stored-value admin route does not expose admin UI in demo mode', async ({ page }) => {
  await page.goto('/admin/stored-value');
  // The first server render can be slow on a cold shared CI runner.
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
});
