import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('demo member requests and admin booking status actions stay wired to the fixture context', () => {
  const account = readFileSync('app/account/AccountClient.tsx', 'utf8');
  const admin = readFileSync('app/admin/AdminClient.tsx', 'utf8');
  const context = readFileSync('context/OrderContext.tsx', 'utf8');

  assert.doesNotMatch(account, /initialTab === 'requests' && !production/);
  assert.match(account, /id="requests-tab"/);
  assert.match(account, /bookings\.map\(\(booking\)/);
  assert.match(account, /cancelBooking\(bookingId\)/);
  assert.match(account, /Hủy đặt bàn/);
  assert.match(admin, /updateBookingStatus/);
  assert.match(admin, /aria-label=\{t\(`Trạng thái đặt bàn \$\{b\.id\}`/);
  assert.match(context, /updateBookingStatus: \(bookingId: string, status: Booking\['status'\]\)/);
});
