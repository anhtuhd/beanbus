import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test.skip(
  process.env.NEXT_PUBLIC_APP_MODE !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true',
  'Guest notification smoke test runs with the dedicated local production command.',
);

function tomorrowPickup() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T11:30`;
}

test('same-browser guest receives status updates and a forged cookie is rejected', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('beanbus_cart', JSON.stringify([{
      cartItemId: 'cd-1-guest-notification',
      product: {
        id: 'cd-1', categoryId: 'colddrip', nameVi: 'Cold-drip Quế Hoa', nameEn: 'Osmanthus Cold-drip',
        descriptionVi: '', descriptionEn: '', price: 35000,
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
        isAvailable: true,
      },
      quantity: 1, selectedOptions: [], unitPrice: 35000, itemTotal: 35000,
    }]));
  });

  await page.goto('/order/checkout');
  await page.getByLabel('Chọn thời gian nhận đồ').fill(tomorrowPickup());
  await page.getByLabel('Họ và tên *').fill('Khách Thông Báo');
  await page.getByLabel('Số điện thoại *').fill('0937936688');
  await page.getByLabel(/Thanh toán khi nhận hàng/).check();
  await page.getByRole('button', { name: /Xác Nhận Đặt Hàng/ }).click();
  await expect(page).toHaveURL(/\/order\/confirmation\/[0-9a-f-]{36}\?receipt=[0-9a-f-]{36}/i);

  const orderId = new URL(page.url()).pathname.split('/').at(-1)!;
  const guestCookie = (await context.cookies()).find((cookie) => cookie.name === 'beanbus_guest_notifications');
  expect(guestCookie?.httpOnly).toBe(true);
  expect(guestCookie?.sameSite).toBe('Lax');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId);
  expect(error).toBeNull();

  await page.reload();
  const bell = page.getByRole('button', { name: 'Thông báo' });
  await expect(bell).toBeVisible();
  await bell.click();
  const dialog = page.getByRole('dialog', { name: 'Thông báo mới' });
  await expect(dialog).toContainText('Đơn hàng đã cập nhật');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(bell).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  await bell.click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('link', { name: /Đơn hàng đã cập nhật/ }).click();
  await expect(page).toHaveURL(new RegExp(`/order/confirmation/${orderId}\\?receipt=`));

  await context.addCookies([{
    name: 'beanbus_guest_notifications',
    value: `${guestCookie!.value}tampered`,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  const guestResponse = await page.request.get('/api/notifications/guest');
  expect(await guestResponse.json()).toMatchObject({ guestSession: false, unreadCount: 0 });
  await page.goto(`/order/guest/${orderId}`);
  await expect(page).toHaveURL(/\/notifications$/);
});
