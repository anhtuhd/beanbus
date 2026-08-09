import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCustomerRequestInput } from '../lib/requests/customer-request-input.ts';

const common = {
  consentToContact: true,
  idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: '  Nguyễn Văn An  ',
  phone: '0937 936 688',
};

test('normalizes a contact request', () => {
  assert.deepEqual(parseCustomerRequestInput({
    ...common,
    type: 'contact',
    email: '  AN@EXAMPLE.COM ',
    message: '  Tôi cần tư vấn về sản phẩm cà phê.  ',
  }), {
    ok: true,
    data: {
      consentToContact: true,
      email: 'an@example.com',
      idempotencyKey: common.idempotencyKey,
      message: 'Tôi cần tư vấn về sản phẩm cà phê.',
      name: 'Nguyễn Văn An',
      phone: '+84937936688',
      type: 'contact',
    },
  });
});

test('accepts typed RSVP and B2B request details', () => {
  const rsvp = parseCustomerRequestInput({ ...common, type: 'rsvp', subjectReference: 'event-1' });
  if (!rsvp.ok || rsvp.data.type !== 'rsvp') assert.fail('expected a valid RSVP');
  assert.equal(rsvp.data.subjectReference, 'event-1');

  const quote = parseCustomerRequestInput({
    ...common,
    type: 'b2b_quote',
    subjectReference: 'bean-2',
    organization: '  Quán An Coffee ',
    volumeRange: '30_100',
  });
  if (!quote.ok || quote.data.type !== 'b2b_quote') assert.fail('expected a valid B2B quote');
  assert.equal(quote.data.organization, 'Quán An Coffee');
  assert.equal(quote.data.volumeRange, '30_100');
});

test('rejects malformed contacts and mismatched type-specific fields', () => {
  assert.deepEqual(
    parseCustomerRequestInput({ ...common, type: 'contact', message: 'short' }),
    { ok: false, error: 'INVALID_MESSAGE' }
  );
  assert.deepEqual(
    parseCustomerRequestInput({ ...common, type: 'rsvp', subjectReference: 'bean-1' }),
    { ok: false, error: 'INVALID_EVENT' }
  );
  assert.deepEqual(
    parseCustomerRequestInput({ ...common, type: 'b2b_quote', volumeRange: 'unlimited' }),
    { ok: false, error: 'INVALID_VOLUME_RANGE' }
  );
  assert.deepEqual(
    parseCustomerRequestInput({ ...common, type: 'contact', message: 'Nội dung hợp lệ', consentToContact: false }),
    { ok: false, error: 'CONSENT_REQUIRED' }
  );
});
