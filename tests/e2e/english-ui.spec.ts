import { expect, test } from '@playwright/test';

const routes = [
  '/', '/menu', '/events', '/blog', '/booking', '/contact', '/about', '/order', '/account', '/admin',
  '/forbidden', '/blog/missing-post', '/events/missing-event', '/menu/missing-product',
  '/order/confirmation/missing-order',
];
const untranslatedUiWords = /\b(Đặt|Tìm|Lưu|Hủy|Thêm|Đóng|Gửi|Quản lý|Cập nhật|Dùng voucher|Đăng ký|Xem menu|Thử lại)\b/u;

test('English mode translates interactive button labels on primary routes', async ({ page }) => {
  // This intentionally covers hard navigation across every primary route on one page.
  test.slow();
  await page.addInitScript(() => localStorage.setItem('beanbus_lang', 'en'));

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');

    const labels = await page.locator('button, a.btn').evaluateAll((elements) =>
      elements.map((element) => element.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean)
    );
    expect(labels.filter((label) => untranslatedUiWords.test(label)), `${route} contains an untranslated interactive label`).toEqual([]);
  }
});
