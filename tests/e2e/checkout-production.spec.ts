import { expect, test } from '@playwright/test';

test.skip(
  process.env.NEXT_PUBLIC_APP_MODE !== 'production',
  'Production checkout contract runs through the dedicated production script.'
);

test('production checkout exposes only configured payment methods', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('beanbus_cart', JSON.stringify([{
      cartItemId: 'cd-1-production-check',
      product: {
        id: 'cd-1',
        categoryId: 'colddrip',
        nameVi: 'Cold-drip Quế Hoa',
        nameEn: 'Osmanthus Cold-drip',
        descriptionVi: 'Cold-drip hoa quế',
        descriptionEn: 'Osmanthus cold drip',
        price: 35000,
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
        isAvailable: true,
      },
      quantity: 1,
      selectedOptions: [],
      unitPrice: 35000,
      itemTotal: 35000,
    }]));
  });

  await page.goto('/order/checkout');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thanh Toán Đơn Hàng');
  await expect(page.getByLabel(/Thanh toán khi nhận hàng/)).toBeChecked();
  await expect(page.getByLabel(/Thanh toán QR Code/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Xác Nhận Đặt Hàng/ })).toBeVisible();
});
