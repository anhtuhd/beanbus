import { expect, test } from '@playwright/test';

test('member demo tabs and profile update remain interactive', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Nguyễn Văn Bean');

  await page.getByRole('tab', { name: /Lịch Sử Đơn Hàng/ }).click();
  await expect(page.locator('#orders-panel')).toBeVisible();
  await page.getByRole('tab', { name: /Kho Voucher/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('BEANBUS10');
  await page.getByRole('button', { name: /Dùng voucher/ }).first().click();
  await expect(page).toHaveURL(/\/order\/cart$/);
  await expect(page.getByRole('status').filter({ hasText: 'BEANBUS10' })).toBeVisible();
  await page.goto('/account');
  await page.getByRole('tab', { name: /Thẻ Hội Viên/ }).click();

  await page.getByLabel('Họ và tên').fill('Nguyễn Văn Bean Updated');
  await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  await expect(page.getByText('Đã cập nhật hồ sơ.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Nguyễn Văn Bean Updated');
});

test('member account restores the selected tab from a deep link', async ({ page }) => {
  await page.goto('/account?tab=orders');
  await expect(page.locator('#orders-panel')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Lịch Sử Đơn Hàng/ })).toHaveAttribute('aria-selected', 'true');
});

test('member demo exposes booking requests and admin can update their status', async ({ page }) => {
  await page.goto('/account?tab=requests');
  await expect(page.locator('#requests-panel')).toBeVisible();
  await expect(page.locator('#requests-panel')).toContainText('BK-2026-104');

  await page.goto('/admin');
  await page.getByRole('tab', { name: /Quản lý Đặt bàn/ }).click();
  const status = page.getByLabel('Trạng thái đặt bàn BK-2026-104');
  await status.selectOption('completed');
  await expect(status).toHaveValue('completed');
  await expect(page.getByRole('status').filter({ hasText: 'Đã cập nhật trạng thái đặt bàn BK-2026-104.' })).toBeVisible();
});

test('member demo can cancel a booking request from the requests tab', async ({ page }) => {
  await page.goto('/account?tab=requests');
  await page.getByRole('button', { name: 'Hủy đặt bàn' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã hủy yêu cầu đặt bàn.' })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText('Đã hủy');
  await expect(page.getByRole('button', { name: 'Hủy đặt bàn' })).toHaveCount(0);
});

test('admin demo tabs support menu create and availability actions', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('status').filter({ hasText: 'Chế độ demo' })).toBeVisible();
  await page.getByRole('tab', { name: /Quản lý Thực đơn Menu/ }).click();

  await page.getByRole('button', { name: /Thêm Món Mới Vào Menu/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm Sản Phẩm Mới' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Đóng thêm sản phẩm' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Thêm Món Mới Vào Menu/ })).toBeFocused();

  await page.getByRole('button', { name: /Thêm Món Mới Vào Menu/ }).click();
  await expect(dialog).toBeVisible();
  const createForm = page.locator('form').filter({ hasText: 'Thêm Món Ngay' });
  await createForm.getByRole('textbox').fill('Cold Brew Test');
  await createForm.getByRole('spinbutton').fill('55000');
  await createForm.getByRole('button', { name: 'Thêm Món Ngay' }).click();
  await expect(page.getByText('Cold Brew Test', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Đánh dấu Hết Hàng/ }).first().click();
  await expect(page.getByRole('button', { name: /Đánh dấu Còn Hàng/ }).first()).toBeVisible();
});

test('admin demo tabs stay keyboard-operable and usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin');

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');

  const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
  await expect(page.locator('#admin-bookings-panel')).toBeVisible();
});
