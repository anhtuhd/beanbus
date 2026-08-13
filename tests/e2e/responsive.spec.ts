import { expect, test } from '@playwright/test';

const routes = ['/', '/menu', '/events', '/blog', '/booking', '/contact', '/admin'];

for (const viewport of [
  { name: 'small-mobile', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`primary routes do not overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        content: document.documentElement.scrollWidth,
      }));

      expect(dimensions.content, `${route} overflows at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport);
    }

    await page.goto('/');
    await page.screenshot({ path: `/tmp/beanbus-home-${viewport.name}.png`, fullPage: true });
    await page.goto('/admin');
    await page.screenshot({ path: `/tmp/beanbus-admin-${viewport.name}.png`, fullPage: true });
  });
}

test('about content and product customizer fit on a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  await page.goto('/about');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/menu/cd-1');
  await page.getByRole('button', { name: 'Chọn món' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cold-drip Quế Hoa' });

  await expect.poll(() => dialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    right: element.getBoundingClientRect().right,
  }))).toEqual({ scrollWidth: 280, clientWidth: 280, right: 300 });
});
