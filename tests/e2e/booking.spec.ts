import { expect, test } from '@playwright/test';

function futureDate(days = 2) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function submitBooking(page: import('@playwright/test').Page) {
  await page.goto('/booking');
  await page.getByLabel('Ngày đặt *').fill(futureDate());
  await page.getByRole('button', { name: '15:30' }).click();
  await page.getByRole('button', { name: /Ban công/ }).click();
  await page.getByLabel('Họ và tên của bạn *').fill('Nguyễn Văn An');
  await page.getByLabel('Số điện thoại liên hệ *').fill('0937936688');
  await page.getByLabel(/Tôi đồng ý để Beanbus liên hệ/).check();
  await page.getByRole('button', { name: /Gửi Yêu Cầu Đặt Bàn/ }).click();
}

test('visitor can submit a demo reservation and receive a real local reference', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await submitBooking(page);

  await expect(page.getByRole('heading', { level: 2 })).toContainText('Đặt bàn thành công');
  await expect(page.getByText('Mã yêu cầu:')).toContainText(/BK-\d{4}-\d+/);
  await expect(page.getByText(/SMS|Zalo/)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('booking remains usable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/booking');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Đặt Bàn');
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: '/tmp/beanbus-booking-mobile.png', fullPage: true });
});
