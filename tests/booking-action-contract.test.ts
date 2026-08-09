import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/booking/actions.ts', import.meta.url), 'utf8');

test('booking action sends only validated request fields to the database', () => {
  assert.match(actionSource, /getAppMode\(\) !== 'production'/);
  assert.match(actionSource, /parseBookingRequestInput\(input\)/);
  assert.match(actionSource, /p_reservation_at: parsed\.data\.reservationAt/);
  assert.match(actionSource, /p_consent_to_contact: parsed\.data\.consentToContact/);
  assert.doesNotMatch(actionSource, /p_status:/);
  assert.doesNotMatch(actionSource, /p_notification_status:/);
});

test('booking receipt reports the server-owned pending state', () => {
  assert.match(actionSource, /status: 'pending'/);
  assert.match(actionSource, /booking\.booking_number/);
});
