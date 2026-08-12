import { expect, test } from '@playwright/test';

async function addFirstProductAndOpenCheckout(page: import('@playwright/test').Page) {
  await page.goto('/order');
  await page.getByRole('button', { name: 'Tuỳ chọn' }).first().click();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();

  const cart = page.getByRole('dialog', { name: 'Giỏ hàng của bạn' });
  await expect(cart).toBeVisible();
  await cart.getByRole('link', { name: /Tiến hành Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/order\/checkout$/);
}

test('visitor can place a demo COD order and see its confirmation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await addFirstProductAndOpenCheckout(page);
  await expect(page.getByRole('status')).toContainText('DEMO');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thanh Toán Đơn Hàng');
  await page.screenshot({ path: '/tmp/beanbus-checkout-desktop.png', fullPage: true });

  await page.getByLabel('Chọn thời gian nhận đồ').fill('2026-08-10T11:30');
  await page.getByLabel('Họ và tên *').fill('Nguyễn Văn An');
  await page.getByLabel('Số điện thoại *').fill('0937936688');
  await page.getByLabel(/Thanh toán khi nhận hàng/).check();
  await page.getByRole('button', { name: /Xác Nhận Đặt Hàng/ }).click();

  await expect(page).toHaveURL(/\/order\/confirmation\/DH-[0-9]{6}[A-Za-z0-9]{6}/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Đặt Hàng Thành Công');
  await page.screenshot({ path: '/tmp/beanbus-confirmation-desktop.png', fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('checkout remains usable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await addFirstProductAndOpenCheckout(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thanh Toán Đơn Hàng');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: '/tmp/beanbus-checkout-mobile.png', fullPage: true });
});
