import { expect, test } from '@playwright/test';

test('visitor can add a product and reach checkout', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/order');
  await expect(page.getByRole('status')).toContainText('DEMO');

  await page.getByRole('button', { name: 'Tuỳ chọn' }).first().click();
  await expect(page.getByText('Ghi chú đặc biệt')).toBeVisible();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();

  const cart = page.getByRole('dialog', { name: 'Giỏ hàng của bạn' });
  await expect(cart).toBeVisible();
  await cart.getByRole('link', { name: /Tiến hành Thanh toán/ }).click();

  await expect(page).toHaveURL(/\/order\/checkout$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thanh Toán Đơn Hàng');
  expect(consoleErrors).toEqual([]);
});
