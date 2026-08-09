import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDiscount } from '../lib/commerce/pricing.ts';

test('calculateDiscount applies a percentage voucher', () => {
  assert.equal(calculateDiscount(105_000, { type: 'percent', value: 10 }), 10_500);
});

test('calculateDiscount caps a fixed discount at the subtotal', () => {
  assert.equal(calculateDiscount(15_000, { type: 'fixed', value: 20_000 }), 15_000);
});

test('calculateDiscount returns zero without a voucher or positive subtotal', () => {
  assert.equal(calculateDiscount(50_000, null), 0);
  assert.equal(calculateDiscount(-1, { type: 'fixed', value: 20_000 }), 0);
});
