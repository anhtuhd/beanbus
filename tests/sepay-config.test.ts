import assert from 'node:assert/strict';
import test from 'node:test';
import { getSepayConfig } from '../lib/payments/sepay-config.ts';

const validConfig = {
  SEPAY_WEBHOOK_SECRET: 'test-webhook-secret-123',
  SEPAY_BANK_CODE: 'MB',
  SEPAY_BANK_ACCOUNT: '0937936688',
  SEPAY_ACCOUNT_NAME: 'BEANBUS COFFEE ROASTER',
};

test('accepts the server-only Sepay payment configuration', () => {
  assert.deepEqual(getSepayConfig(validConfig), {
    webhookSecret: validConfig.SEPAY_WEBHOOK_SECRET,
    bankCode: 'MB',
    accountNumber: '0937936688',
    accountName: 'BEANBUS COFFEE ROASTER',
  });
});

test('rejects missing or malformed Sepay destination and webhook secrets', () => {
  assert.throws(() => getSepayConfig({}), /SEPAY_WEBHOOK_SECRET/);
  assert.throws(() => getSepayConfig({ ...validConfig, SEPAY_BANK_ACCOUNT: '***' }), /SEPAY_BANK_ACCOUNT/);
});
