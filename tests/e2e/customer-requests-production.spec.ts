import { expect, test, type Locator, type Page } from '@playwright/test';

test.skip(
  process.env.NEXT_PUBLIC_APP_MODE !== 'production',
  'Production request states run through the dedicated production script.'
);

type Scenario = {
  name: string;
  requiresPublishedEvents?: boolean;
  requiresPublishedCatalog?: boolean;
  openAndFill(page: Page): Promise<Locator>;
};

const scenarios: Scenario[] = [
  {
    name: 'contact',
    async openAndFill(page) {
      await page.goto('/contact');
      await page.getByLabel('Họ và tên *').fill('Nguyễn Văn An');
      await page.getByLabel('Số điện thoại *').fill('0937936688');
      await page.getByLabel('Nội dung nhắn gửi *').fill('Tôi cần tư vấn về hạt cà phê cho văn phòng.');
      await page.getByLabel(/Tôi đồng ý để Beanbus liên hệ về nội dung/).check();
      return page.locator('form button[type="submit"]');
    },
  },
  {
    name: 'RSVP',
    requiresPublishedEvents: true,
    async openAndFill(page) {
      await page.goto('/events');
      await page.getByRole('button', { name: 'Yêu Cầu Tham Gia' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Yêu Cầu Tham Gia Sự Kiện' });
      await dialog.getByLabel('Họ và tên của bạn *').fill('Nguyễn Văn An');
      await dialog.getByLabel('Số điện thoại liên hệ *').fill('0937936688');
      await dialog.getByLabel(/Tôi đồng ý để Beanbus liên hệ về sự kiện/).check();
      return dialog.locator('form button[type="submit"]');
    },
  },
  {
    name: 'B2B',
    requiresPublishedCatalog: true,
    async openAndFill(page) {
      await page.goto('/#beans');
      await page.getByRole('button', { name: 'Nhận giá sỉ' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Yêu Cầu Báo Giá Cà Phê Sỉ (B2B)' });
      await dialog.getByLabel('Họ và tên của bạn *').fill('Nguyễn Văn An');
      await dialog.getByLabel('Số điện thoại liên hệ *').fill('0937936688');
      await dialog.getByLabel(/Tôi đồng ý để Beanbus liên hệ về yêu cầu báo giá/).check();
      return dialog.locator('form button[type="submit"]');
    },
  },
];

for (const scenario of scenarios) {
  test(`${scenario.name} exposes loading, network failure, and retry states`, async ({ page }) => {
    test.skip(
      Boolean(scenario.requiresPublishedEvents && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://example.supabase.co'),
      'RSVP production state requires a configured Supabase content runtime.'
    );
    if (scenario.requiresPublishedCatalog) {
      await page.goto('/');
      test.skip(
        await page.getByRole('alert').filter({ hasText: 'Chưa thể tải dữ liệu cửa hàng' }).count() > 0,
        'B2B production state requires a configured published catalog.'
      );
    }
    let postCount = 0;
    await page.route('**/*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      postCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.abort('connectionfailed');
    });

    const submit = await scenario.openAndFill(page);
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText('Đang gửi');
    await expect(page.locator('p[role="alert"]')).toContainText('Kết nối bị gián đoạn');
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect.poll(() => postCount).toBeGreaterThanOrEqual(2);
    await expect(page.locator('p[role="alert"]')).toContainText('Kết nối bị gián đoạn');
    await expect(submit).toBeEnabled();
  });
}
