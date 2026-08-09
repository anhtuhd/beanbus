import { expect, test } from '@playwright/test';

test('visitor can submit a contact request and receive a reference', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Họ và tên *').fill('Nguyễn Văn An');
  await page.getByLabel('Số điện thoại *').fill('0937936688');
  await page.getByLabel('Nội dung nhắn gửi *').fill('Tôi cần tư vấn về hạt cà phê cho văn phòng.');
  await page.getByLabel(/Tôi đồng ý để Beanbus liên hệ về nội dung/).check();
  await page.getByRole('button', { name: 'Gửi Tin Nhắn' }).click();

  await expect(page.getByRole('heading', { name: 'Beanbus đã nhận yêu cầu liên hệ' })).toBeVisible();
  await expect(page.getByText('Mã yêu cầu:')).toContainText(/CT-DEMO-\d{6}/);
  await expect(page.getByText(/Thông tin đã được lưu/)).toBeVisible();
});

test('visitor can submit a pending RSVP request', async ({ page }) => {
  await page.goto('/events');
  await page.getByRole('button', { name: 'Yêu Cầu Tham Gia' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Yêu Cầu Tham Gia Sự Kiện' });
  await dialog.getByLabel('Họ và tên của bạn *').fill('Nguyễn Văn An');
  await dialog.getByLabel('Số điện thoại liên hệ *').fill('0937936688');
  await dialog.getByLabel(/Tôi đồng ý để Beanbus liên hệ về sự kiện/).check();
  await dialog.getByRole('button', { name: 'Gửi Yêu Cầu Tham Gia' }).click();

  await expect(dialog.getByRole('heading', { name: 'Đã nhận yêu cầu tham gia' })).toBeVisible();
  await expect(dialog.getByText('Mã yêu cầu:')).toContainText(/EV-DEMO-\d{6}/);
  await expect(dialog.getByText(/sau khi kiểm tra tình trạng chỗ/)).toBeVisible();
});

test('visitor can submit a B2B quote request for a selected bean', async ({ page }) => {
  await page.goto('/#beans');
  await page.getByRole('button', { name: 'Nhận giá sỉ' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Yêu Cầu Báo Giá Cà Phê Sỉ (B2B)' });
  await expect(dialog.getByText(/Hạt đã chọn:/)).toContainText('Fine Robusta Honey');
  await dialog.getByLabel('Họ và tên của bạn *').fill('Nguyễn Văn An');
  await dialog.getByLabel('Số điện thoại liên hệ *').fill('0937936688');
  await dialog.getByLabel('Tên Quán Cà Phê / Đơn vị').fill('An Coffee');
  await dialog.getByLabel('Sản lượng dự kiến / Tháng').selectOption('30_100');
  await dialog.getByLabel(/Tôi đồng ý để Beanbus liên hệ về yêu cầu báo giá/).check();
  await dialog.getByRole('button', { name: 'Gửi Yêu Cầu Báo Giá' }).click();

  await expect(dialog.getByRole('heading', { name: 'Đã nhận yêu cầu báo giá' })).toBeVisible();
  await expect(dialog.getByText('Mã yêu cầu:')).toContainText(/BQ-DEMO-\d{6}/);
});

test('request forms and modals do not overflow a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/contact');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.goto('/events');
  await page.getByRole('button', { name: 'Yêu Cầu Tham Gia' }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: '/tmp/beanbus-rsvp-mobile.png' });

  await page.getByRole('button', { name: 'Đóng' }).click();
  await page.goto('/#beans');
  await page.getByRole('button', { name: 'Nhận giá sỉ' }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: '/tmp/beanbus-b2b-mobile.png' });
});
