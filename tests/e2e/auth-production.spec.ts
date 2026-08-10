import { expect, test } from '@playwright/test';

test.skip(
  process.env.NEXT_PUBLIC_APP_MODE !== 'production',
  'Production auth guards require the production-mode web server.'
);

test('protected routes redirect to a provider-gated login screen', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hội Viên Beanbus Coffee');
  await expect(page.getByRole('button', { name: 'Nhận mã qua Zalo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toBeDisabled();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);

  for (const path of [
    '/admin/requests',
    '/admin/orders',
    '/admin/catalog',
    '/admin/content',
    '/admin/members',
    '/admin/loyalty',
    '/admin/vouchers',
    '/admin/rewards',
    '/admin/stored-value',
    '/admin/orders/not-a-user-id',
    '/admin/requests/not-a-user-id',
    '/admin/members/not-a-user-id',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  }
  expect(consoleErrors).toEqual([]);
});
