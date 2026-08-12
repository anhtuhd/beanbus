import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  buildSepayQrUrl,
  parseSepayWebhook,
  parseSepayWebhookBody,
  resolveSepayPaymentCode,
  verifySepayHmac,
} from '../lib/payments/sepay.ts';

const payload = {
  id: 92704,
  gateway: 'MBBank',
  transactionDate: '2026-08-09 14:30:00',
  accountNumber: '0937936688',
  subAccount: '',
  code: 'DH-260809ABC123',
  content: 'DH-260809ABC123 thanh toan',
  transferType: 'in',
  description: 'NGUYEN VAN A chuyen tien',
  transferAmount: 81000,
  accumulated: 1000000,
  referenceCode: 'FT26080912345',
};

test('verifies Sepay HMAC against timestamp and untouched raw body', () => {
  const secret = 'test-webhook-secret';
  const timestamp = '1786260600';
  const rawBody = JSON.stringify(payload);
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;

  assert.equal(verifySepayHmac({ rawBody, secret, signature, timestamp, nowMs: 1786260600_000 }), true);
  assert.equal(verifySepayHmac({ rawBody: `${rawBody} `, secret, signature, timestamp, nowMs: 1786260600_000 }), false);
  assert.equal(verifySepayHmac({ rawBody, secret, signature, timestamp, nowMs: 1786261000_000 }), false);
});

test('parses the documented inbound Sepay transaction shape', () => {
  assert.deepEqual(parseSepayWebhook(payload), {
    ...payload,
    transactionAt: '2026-08-09T07:30:00.000Z',
  });
  assert.equal(parseSepayWebhook({ ...payload, transferType: 'out' })?.transferType, 'out');
  assert.equal(parseSepayWebhook({ ...payload, transferAmount: -1 }), null);
  assert.equal(parseSepayWebhook({ ...payload, id: '92704' }), null);
  assert.equal(parseSepayWebhook({ ...payload, id: 0 })?.id, 0);
});

test('parses both JSON and URL-encoded webhook bodies', () => {
  assert.deepEqual(parseSepayWebhookBody(JSON.stringify(payload), 'application/json'), payload);
  const formBody = new URLSearchParams({
    ...payload,
    id: String(payload.id),
    transferAmount: String(payload.transferAmount),
    accumulated: String(payload.accumulated),
  }).toString();
  assert.deepEqual(parseSepayWebhookBody(formBody, 'application/x-www-form-urlencoded'), payload);
  assert.equal(parseSepayWebhookBody('not-json', 'application/json'), null);
});

test('resolves the Beanbus payment code from the authenticated content fallback', () => {
  assert.equal(resolveSepayPaymentCode(null, 'Thanh toan dh-260809abc123'), 'DH-260809ABC123');
  assert.equal(resolveSepayPaymentCode('DH-260809def456', 'unrelated content'), 'DH-260809DEF456');
  assert.equal(resolveSepayPaymentCode(null, 'Thanh toan DH260809ABC123'), null);
});

test('builds a VietQR URL from server-owned payment instructions', () => {
  const url = new URL(buildSepayQrUrl({
    accountName: 'BEANBUS COFFEE ROASTER',
    accountNumber: '0937936688',
    amountVnd: 81000,
    bankCode: 'MB',
    paymentCode: 'DH-260809ABC123',
  }));

  assert.equal(url.origin, 'https://vietqr.app');
  assert.equal(url.searchParams.get('acc'), '0937936688');
  assert.equal(url.searchParams.get('amount'), '81000');
  assert.equal(url.searchParams.get('des'), 'DH-260809ABC123');
  assert.equal(url.searchParams.get('template'), 'compact');
});
