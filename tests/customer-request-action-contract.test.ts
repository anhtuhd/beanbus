import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/request-actions.ts', import.meta.url), 'utf8');

test('customer request action is production-only and uses normalized fields', () => {
  assert.match(actionSource, /getAppMode\(\) !== 'production'/);
  assert.match(actionSource, /parseCustomerRequestInput\(input\)/);
  assert.match(actionSource, /p_request_type: data\.type/);
  assert.match(actionSource, /p_consent_to_contact: data\.consentToContact/);
  assert.doesNotMatch(actionSource, /p_status:/);
  assert.doesNotMatch(actionSource, /p_notification_status:/);
});

test('customer request action issues typed server references', () => {
  assert.match(actionSource, /contact: 'CT'/);
  assert.match(actionSource, /rsvp: 'EV'/);
  assert.match(actionSource, /b2b_quote: 'BQ'/);
  assert.match(actionSource, /status: 'pending'/);
});
