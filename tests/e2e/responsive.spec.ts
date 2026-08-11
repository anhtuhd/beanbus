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
