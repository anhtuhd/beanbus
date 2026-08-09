import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBookingRequestInput } from '../lib/requests/booking-input.ts';

const validInput = {
  idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Nguyễn Văn An',
  phone: '0937 936 688',
  date: '2026-08-10',
  time: '14:30',
  guestCount: 4,
  seatingArea: 'indoor',
  note: 'Bàn gần ổ cắm',
  consentToContact: true,
};

test('normalizes a valid booking request into a Vietnam-time reservation', () => {
  assert.deepEqual(parseBookingRequestInput(validInput, Date.parse('2026-08-09T07:00:00Z')), {
    ok: true,
    data: {
      idempotencyKey: validInput.idempotencyKey,
      name: 'Nguyễn Văn An',
      phone: '+84937936688',
      reservationAt: '2026-08-10T07:30:00.000Z',
      guestCount: 4,
      seatingArea: 'indoor',
      note: 'Bàn gần ổ cắm',
      consentToContact: true,
    },
  });
});

test('rejects stale slots, malformed contact data, and missing consent', () => {
  const now = Date.parse('2026-08-09T07:00:00Z');
  assert.equal(parseBookingRequestInput({ ...validInput, date: '2026-08-09', time: '14:10' }, now).ok, false);
  assert.equal(parseBookingRequestInput({ ...validInput, phone: '1234' }, now).ok, false);
  assert.equal(parseBookingRequestInput({ ...validInput, guestCount: 21 }, now).ok, false);
  assert.equal(parseBookingRequestInput({ ...validInput, consentToContact: false }, now).ok, false);
});

test('rejects reservations beyond the supported 90-day window', () => {
  const now = Date.parse('2026-08-09T07:00:00Z');
  assert.equal(parseBookingRequestInput({ ...validInput, date: '2026-12-01' }, now).ok, false);
});
