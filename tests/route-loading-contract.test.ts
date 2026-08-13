import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const accountLoading = readFileSync('app/account/loading.tsx', 'utf8');
const adminLoading = readFileSync('app/admin/loading.tsx', 'utf8');
const bookingPage = readFileSync('app/booking/page.tsx', 'utf8');
const contactPage = readFileSync('app/contact/page.tsx', 'utf8');
const cartPage = readFileSync('app/order/cart/page.tsx', 'utf8');
const cartClient = readFileSync('app/order/cart/CartClient.tsx', 'utf8');
const checkoutPage = readFileSync('app/order/checkout/page.tsx', 'utf8');
const checkoutClient = readFileSync('app/order/checkout/CheckoutClient.tsx', 'utf8');

test('account and admin routes expose accessible loading states', () => {
  assert.match(accountLoading, /role="status"/);
  assert.match(accountLoading, /Đang tải dữ liệu hội viên/);
  assert.match(adminLoading, /role="status"/);
  assert.match(adminLoading, /Đang tải bảng điều hành/);
  assert.match(accountLoading, /accountPage/);
  assert.match(adminLoading, /adminPage/);
  assert.match(accountLoading, /loadingBanner/);
  assert.match(adminLoading, /loadingBanner/);
});

test('booking and contact routes keep interactive forms behind server metadata shells', () => {
  assert.doesNotMatch(bookingPage, /'use client'/);
  assert.doesNotMatch(contactPage, /'use client'/);
  assert.match(bookingPage, /export const metadata/);
  assert.match(contactPage, /export const metadata/);
  assert.match(bookingPage, /<BookingClient \/>/);
  assert.match(contactPage, /<ContactClient \/>/);
});

test('cart and checkout routes keep interactive commerce behind private server shells', () => {
  for (const page of [cartPage, checkoutPage]) {
    assert.doesNotMatch(page, /['"]use client['"]/);
    assert.match(page, /export const metadata/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
  }
  assert.match(cartPage, /<CartClient catalogProducts=\{products\} \/>/);
  assert.match(checkoutPage, /<CheckoutClient catalogProducts=\{products\} \/>/);
  assert.match(cartClient, /'use client'/);
  assert.match(checkoutClient, /'use client'/);
});
