import { expect, test } from '@playwright/test';

test('event and blog deep links expose indexed content and honest not-found states', async ({ page }) => {
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sự Kiện');
  await page.getByRole('link', { name: 'Chi tiết' }).first().click();
  await expect(page).toHaveURL(/\/events\/event-1$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Workshop Cupping');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Workshop Cupping');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/events\/event-1$/);
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.some((value) => value.includes('"@type":"Event"'))).toBeTruthy();

  await page.goto('/events/khong-ton-tai');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tìm thấy sự kiện');

  await page.goto('/blog');
  await page.getByRole('link', { name: 'Đọc bài viết chi tiết' }).first().click();
  await expect(page).toHaveURL(/\/blog\/phan-biet-arabica-va-robusta$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Arabica Và Robusta');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Arabica Và Robusta');
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('Hàm lượng Caffeine');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/phan-biet-arabica-va-robusta$/);

  await page.goto('/blog/khong-ton-tai');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tìm thấy bài viết');

  await page.goto('/menu/cd-1');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/menu\/cd-1$/);
  await expect.poll(async () => {
    const productJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    return productJsonLd.some((value) => value.includes('"@type":"Product"'));
  }).toBe(true);
});

test('content remains usable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/events', '/events/event-1', '/blog', '/blog/phan-biet-arabica-va-robusta']) {
    await page.goto(path);
    const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
  }
});

test('public content keeps canonical navigation without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Xem menu', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Xem menu', exact: true }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Menu');

  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sự Kiện');
  await page.getByRole('link', { name: 'Chi tiết' }).first().click();
  await expect(page).toHaveURL(/\/events\/event-1$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Workshop Cupping');

  await page.goto('/blog');
  await expect(page.getByRole('link', { name: 'Đọc bài viết chi tiết' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Đọc bài viết chi tiết' }).first().click();
  await expect(page).toHaveURL(/\/blog\/phan-biet-arabica-va-robusta$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Arabica Và Robusta');

  await page.goto('/menu');
  await page.getByRole('link', { name: /Cold-drip Quế Hoa/ }).first().click();
  await expect(page).toHaveURL(/\/menu\/cd-1$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Cold-drip Quế Hoa');

  await page.goto('/order');
  await expect(page.getByText('JavaScript đang tắt hoặc', { exact: false })).toBeVisible();
  await context.close();
});

test('sitemap and robots expose only public discovery routes', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  expect(xml).toContain('/events/event-1');
  expect(xml).toContain('/blog/phan-biet-arabica-va-robusta');
  expect(xml).not.toContain('/admin');

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /admin/');
});
