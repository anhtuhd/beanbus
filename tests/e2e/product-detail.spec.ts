import { expect, test } from '@playwright/test';

test('visitor can open a product detail and add a configured item', async ({ page }) => {
  await page.goto('/menu/cd-1');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cold-drip Quế Hoa');
  await page.getByRole('button', { name: 'Chọn món' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Cold-drip Quế Hoa' })).toBeVisible();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();

  await expect(page.getByText('Giỏ Hàng Của Bạn')).toBeVisible();
  await expect(page.getByText('Cold-drip Quế Hoa').last()).toBeVisible();
});
