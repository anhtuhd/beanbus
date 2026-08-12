import { expect, test } from '@playwright/test';

test('product customizer traps focus, closes with Escape, and restores its trigger', async ({ page }) => {
  await page.goto('/menu/cd-1');
  const trigger = page.getByRole('button', { name: 'Chọn món' });
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Cold-drip Quế Hoa' });
  const close = dialog.getByRole('button', { name: 'Đóng tùy chỉnh sản phẩm' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: /Thêm vào giỏ/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Sepay dialog traps focus, closes with Escape, and restores checkout focus', async ({ page }) => {
  await page.goto('/order');
  await page.getByRole('button', { name: 'Tuỳ chọn' }).first().click();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await page.getByRole('dialog', { name: 'Giỏ hàng của bạn' }).getByRole('link', { name: /Tiến hành Thanh toán/ }).click();
  await page.getByLabel('Chọn thời gian nhận đồ').fill('2026-08-10T11:30');
  await page.getByLabel('Họ và tên *').fill('Nguyễn Văn An');
  await page.getByLabel('Số điện thoại *').fill('0937936688');

  const trigger = page.getByRole('button', { name: 'Tiếp Tục Quét Mã QR Sepay' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Thanh Toán QR Code Sepay' });
  await expect(dialog.getByRole('button', { name: 'Đóng thanh toán QR' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: /Xác Nhận Đã Chuyển Khoản/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('cart drawer and RSVP restore focus to their opening controls', async ({ page }) => {
  await page.goto('/events');
  const cartTrigger = page.getByRole('button', { name: 'Giỏ hàng' });
  await cartTrigger.click();
  const cart = page.getByRole('dialog', { name: 'Giỏ hàng của bạn' });
  await expect(cart.getByRole('button', { name: 'Đóng giỏ hàng' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cart).toBeHidden();
  await expect(cartTrigger).toBeFocused();

  const rsvpTrigger = page.getByRole('button', { name: 'Yêu Cầu Tham Gia' }).first();
  await rsvpTrigger.click();
  const rsvp = page.getByRole('dialog', { name: 'Yêu Cầu Tham Gia Sự Kiện' });
  await expect(rsvp.getByRole('button', { name: 'Đóng' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(rsvp.getByLabel('Họ và tên của bạn *')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rsvp).toBeHidden();
  await expect(rsvpTrigger).toBeFocused();
});

test('home quote and gallery dialogs support keyboard close and focus return', async ({ page }) => {
  await page.goto('/');
  const quoteTrigger = page.getByRole('button', { name: 'Liên hệ báo giá sỉ B2B' });
  await quoteTrigger.click();
  const quote = page.getByRole('dialog', { name: 'Yêu Cầu Báo Giá Cà Phê Sỉ (B2B)' });
  await expect(quote.getByRole('button', { name: 'Đóng' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(quote).toBeHidden();
  await expect(quoteTrigger).toBeFocused();

  const imageTrigger = page.getByRole('button', { name: /Xem ảnh: Không gian quán/ });
  await imageTrigger.click();
  const gallery = page.getByRole('dialog', { name: 'Xem ảnh không gian Beanbus' });
  await expect(gallery.getByRole('button', { name: 'Đóng ảnh' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(gallery).toBeHidden();
  await expect(imageTrigger).toBeFocused();
});

test('header dropdowns and mobile navigation are keyboard accessible', async ({ page }) => {
  await page.goto('/');
  const desktopMenu = page.getByRole('button', { name: 'Về Beanbus' });
  await desktopMenu.focus();
  await page.keyboard.press('Enter');
  await expect(desktopMenu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  const burger = page.getByRole('button', { name: 'Mở menu' });
  await burger.click();
  await expect(page.getByRole('button', { name: 'Đóng menu' })).toHaveAttribute('aria-expanded', 'true');
  const mobileParent = page.getByRole('button', { name: 'Về Beanbus' });
  await mobileParent.click();
  await expect(mobileParent).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Điều hướng di động' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Mở menu' })).toBeFocused();
});

test('about submenu keeps navigation on one page and scrolls to stable sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Về Beanbus' }).click();
  await page.getByRole('link', { name: 'Câu chuyện' }).click();
  await expect(page).toHaveURL(/\/about#story$/);
  await expect(page.locator('#story')).toBeInViewport();

  await page.getByRole('button', { name: 'Về Beanbus' }).click();
  await page.getByRole('link', { name: 'Xưởng Rang' }).click();
  await expect(page).toHaveURL(/\/about#roastery$/);
  await expect(page.locator('#roastery')).toBeInViewport();
});
