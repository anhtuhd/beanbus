import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOrderReceipt } from '../lib/orders/receipt-data.ts';

const receipt = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  number: 101,
  customerName: 'Nguyễn Văn A',
  customerPhone: '+84912345678',
  fulfillment: 'pickup',
  pickupAt: '2026-08-09T08:30:00Z',
  deliveryAddress: null,
  subtotalVnd: 45000,
  discountVnd: 0,
  totalVnd: 45000,
  paymentMethod: 'cod',
  payment: null,
  paymentStatus: 'pending',
  status: 'pending',
  createdAt: '2026-08-09T07:30:00Z',
  items: [{ id: 'line-1', nameVi: 'Cà phê', nameEn: 'Coffee', quantity: 1, lineTotalVnd: 45000 }],
};

test('accepts a complete canonical receipt DTO', () => {
  assert.deepEqual(parseOrderReceipt(receipt), receipt);
});

test('rejects malformed receipt totals, statuses, and line items', () => {
  assert.equal(parseOrderReceipt({ ...receipt, totalVnd: '45000' }), null);
  assert.equal(parseOrderReceipt({ ...receipt, paymentStatus: 'client-paid' }), null);
  assert.equal(parseOrderReceipt({ ...receipt, items: [{ quantity: 0 }] }), null);
  assert.equal(parseOrderReceipt({ ...receipt, payment: { code: 'BB101', status: 'browser-paid' } }), null);
});

test('accepts server-created pending payment instructions', () => {
  const payment = {
    accountNumber: '0937936688',
    bankCode: 'MB',
    code: 'BB101',
    expiresAt: '2026-08-09T08:00:00Z',
    status: 'pending',
  };
  assert.deepEqual(parseOrderReceipt({ ...receipt, paymentMethod: 'sepay_qr', payment })?.payment, payment);
});
