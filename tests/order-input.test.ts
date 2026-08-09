import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCreateOrderInput } from '../lib/orders/input.ts';

const validOrder = {
  idempotencyKey: '88888888-8888-4888-8888-888888888888',
  customerName: ' Nguyễn Văn A ',
  customerPhone: '0912 345 678',
  fulfillment: 'pickup',
  pickupAt: '2026-08-09T15:30:00+07:00',
  paymentMethod: 'cod',
  voucherCode: 'beanbus10',
  items: [{ productId: 'cd-1', quantity: 2, optionIds: ['size-l'] }],
};

test('normalizes the narrow order payload accepted by the pricing RPC', () => {
  const result = parseCreateOrderInput(validOrder);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.customerName, 'Nguyễn Văn A');
  assert.equal(result.data.customerPhone, '+84912345678');
  assert.equal(result.data.voucherCode, 'BEANBUS10');
  assert.deepEqual(result.data.items[0], {
    productId: 'cd-1', quantity: 2, optionIds: ['size-l'], specialNote: undefined,
  });
});

test('rejects malformed contacts, quantities, and fulfillment fields', () => {
  assert.equal(parseCreateOrderInput({ ...validOrder, customerPhone: '123' }).ok, false);
  assert.equal(parseCreateOrderInput({ ...validOrder, items: [{ productId: 'cd-1', quantity: 21, optionIds: [] }] }).ok, false);
  assert.equal(parseCreateOrderInput({ ...validOrder, fulfillment: 'delivery', deliveryAddress: 'short' }).ok, false);
});

test('drops duplicate option IDs before the database validation step', () => {
  const result = parseCreateOrderInput({
    ...validOrder,
    items: [{ productId: 'cd-1', quantity: 1, optionIds: ['size-l', 'size-l'] }],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data.items[0].optionIds, ['size-l']);
});
