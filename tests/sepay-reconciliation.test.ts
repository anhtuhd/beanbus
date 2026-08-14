import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSepayApiDate,
  getSepayReconciliationConfig,
  parseSepayV2Response,
  parseSepayV2Transaction,
} from '../lib/payments/sepay-reconciliation.ts';

const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

test('formats reconciliation bounds in SePay Vietnam local datetime format', () => {
  assert.equal(formatSepayApiDate(new Date('2026-08-11T03:15:00.000Z')), '2026-08-11 10:15:00');
});

test('parses an inbound SePay API v2 transaction into the webhook contract', () => {
  const transaction = parseSepayV2Transaction({
    id,
    transaction_date: '2026-08-11 10:15:00',
    account_number: '0937936688',
    transfer_type: 'in',
    amount_in: 35000,
    amount_out: 0,
    transaction_content: 'Thanh toan DH-260811ABC123',
    reference_number: 'FT26069ABC',
    code: 'DH-260811ABC123',
    bank_brand_name: 'MBBank',
  });

  assert.deepEqual(transaction, {
    providerTransactionKey: id,
    transactionAt: '2026-08-11T03:15:00.000Z',
    accountNumber: '0937936688',
    code: 'DH-260811ABC123',
    transferType: 'in',
    transferAmount: 35000,
    referenceCode: 'FT26069ABC',
    gateway: 'MBBank',
    content: 'Thanh toan DH-260811ABC123',
  });

  const contentCode = parseSepayV2Transaction({
    id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
    transaction_date: '2026-08-11T10:15:00+07:00',
    account_number: '0937936688',
    transfer_type: 'in',
    amount_in: 35000,
    amount_out: 0,
    transaction_content: 'Thanh toan DH-260811DEF456',
    reference_number: 'FT26069ABD',
    code: null,
    bank_brand_name: 'MBBank',
  });
  assert.equal(contentCode?.code, 'DH-260811DEF456');
});

test('parses a stored-value code from content when SePay sends no payment code', () => {
  const transaction = parseSepayV2Transaction({
    id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
    transaction_date: '2026-08-14 13:42:00',
    account_number: '0397872462',
    transfer_type: 'in',
    amount_in: 50000,
    amount_out: 0,
    transaction_content: 'DHTP21E3F7BC4B0E342DA7D2 I2CJ4SSC/555958',
    reference_number: 'FT26226132538618',
    code: null,
    bank_brand_name: 'MBBank',
  });

  assert.equal(transaction?.code, 'DHTP21E3F7BC4B0E342DA7D2');
});

test('rejects malformed or unsafe v2 transaction values', () => {
  assert.equal(parseSepayV2Transaction({}), null);
  assert.equal(parseSepayV2Transaction({
    id,
    transaction_date: '2026-08-11 10:15:00',
    account_number: '0937936688',
    transfer_type: 'in',
    amount_in: 0,
    amount_out: 0,
    transaction_content: '',
    reference_number: 'FT26069ABC',
    code: 'DH-260811ABC123',
    bank_brand_name: 'MBBank',
  }), null);
  assert.equal(parseSepayV2Transaction({
    id: 'not-a-uuid',
    transaction_date: '2026-08-11 10:15:00',
    account_number: '0937936688',
    transfer_type: 'in',
    amount_in: 35000,
    amount_out: 0,
    transaction_content: 'DH-260811ABC123',
    reference_number: 'FT26069ABC',
    code: 'DH-260811ABC123',
    bank_brand_name: 'MBBank',
  }), null);
});

test('parses API v2 pagination and keeps only valid transactions', () => {
  const response = parseSepayV2Response({
    status: 'success',
    data: [{
      id,
      transaction_date: '2026-08-11 10:15:00',
      account_number: '0937936688',
      transfer_type: 'in',
      amount_in: 35000,
      amount_out: 0,
      transaction_content: 'DH-260811ABC123',
      reference_number: 'FT26069ABC',
      code: 'DH-260811ABC123',
      bank_brand_name: 'MBBank',
    }, {}],
    meta: { pagination: { current_page: 2, last_page: 4, has_more: true } },
  });

  assert.equal(response?.currentPage, 2);
  assert.equal(response?.lastPage, 4);
  assert.equal(response?.hasMore, true);
  assert.equal(response?.transactions.length, 1);
});

test('rejects a malformed transaction when it carries a Beanbus payment code', () => {
  const response = parseSepayV2Response({
    status: 'success',
    data: [{
      id,
      transaction_date: '2026-08-11 10:15:00',
      account_number: '0937936688',
      transfer_type: 'in',
      amount_in: 0,
      amount_out: 0,
      transaction_content: 'Thanh toan DH-260811BAD999',
      reference_number: 'FT26069BAD',
      code: 'DH-260811BAD999',
      bank_brand_name: 'MBBank',
    }],
    meta: { pagination: { current_page: 1, last_page: 1, has_more: false } },
  });

  assert.equal(response, null);
});

test('reconciliation config requires an API token and cron secret', () => {
  assert.throws(
    () => getSepayReconciliationConfig({}),
    /SEPAY_API_KEY/
  );
  assert.deepEqual(
    getSepayReconciliationConfig({
      SEPAY_API_KEY: 'sepay-api-token-123456',
      CRON_SECRET: 'cron-secret-123456',
    }),
    { apiKey: 'sepay-api-token-123456', cronSecret: 'cron-secret-123456' }
  );
});
