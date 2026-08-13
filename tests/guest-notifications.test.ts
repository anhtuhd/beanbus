import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyFcmErrorCode,
  normalizeFcmHref,
} from '../supabase/functions/_shared/fcm-delivery.ts';
import {
  createGuestSessionToken,
  verifyGuestSessionToken,
} from '../lib/notifications/guest-session-token.ts';
import {
  isSafeNotificationHref,
  isTrustedMutationOrigin,
  parsePushInstallationInput,
} from '../lib/notifications/validation.ts';

const sessionId = '9ed482e3-540a-45ea-8bc4-f5ea7b73d2f6';
const secret = 'guest-notification-secret-with-enough-entropy';

test('guest notification cookie is signed, scoped to its UUID, and rejects tampering', async () => {
  const token = await createGuestSessionToken(sessionId, secret);

  assert.equal(await verifyGuestSessionToken(token, secret), sessionId);
  assert.equal(await verifyGuestSessionToken(`${token}x`, secret), null);
  assert.equal(await verifyGuestSessionToken(token, `${secret}-wrong`), null);
  assert.equal(await verifyGuestSessionToken('v1.not-a-uuid.signature', secret), null);
});

test('notification mutation origin must match the configured HTTP origin', () => {
  assert.equal(isTrustedMutationOrigin('https://www.beanbus.store', 'https://www.beanbus.store'), true);
  assert.equal(isTrustedMutationOrigin('https://evil.example', 'https://www.beanbus.store'), false);
  assert.equal(isTrustedMutationOrigin(null, 'https://www.beanbus.store'), false);
  assert.equal(isTrustedMutationOrigin('javascript:alert(1)', 'https://www.beanbus.store'), false);
});

test('push installation input accepts only bounded FIDs and supported locales', () => {
  assert.deepEqual(parsePushInstallationInput({ fid: 'c'.repeat(48), locale: 'vi' }), {
    ok: true,
    data: { fid: 'c'.repeat(48), locale: 'vi' },
  });
  assert.deepEqual(parsePushInstallationInput({ fid: 'f'.repeat(64), locale: 'en-US' }), {
    ok: true,
    data: { fid: 'f'.repeat(64), locale: 'en' },
  });
  assert.equal(parsePushInstallationInput({ fid: 'short', locale: 'vi' }).ok, false);
  assert.equal(parsePushInstallationInput({ fid: '<script>'.repeat(20), locale: 'vi' }).ok, false);
  assert.equal(parsePushInstallationInput({ fid: 'c'.repeat(48), locale: 'fr' }).ok, false);
});

test('notification links stay on allowlisted internal routes', () => {
  assert.equal(isSafeNotificationHref('/account/orders/9ed482e3-540a-45ea-8bc4-f5ea7b73d2f6'), true);
  assert.equal(isSafeNotificationHref('/order/guest/9ed482e3-540a-45ea-8bc4-f5ea7b73d2f6'), true);
  assert.equal(isSafeNotificationHref('/menu'), true);
  assert.equal(isSafeNotificationHref('//evil.example/path'), false);
  assert.equal(isSafeNotificationHref('https://evil.example/path'), false);
  assert.equal(isSafeNotificationHref('/admin'), false);
  assert.equal(normalizeFcmHref('/admin/orders/9ed482e3-540a-45ea-8bc4-f5ea7b73d2f6'), '/admin/orders/9ed482e3-540a-45ea-8bc4-f5ea7b73d2f6');
  assert.equal(normalizeFcmHref('/admin/security'), null);
  assert.equal(normalizeFcmHref('//evil.example/path'), null);
});

test('FCM delivery errors disable dead FIDs and retry only transient failures', () => {
  assert.deepEqual(
    classifyFcmErrorCode('messaging/installation-id-not-registered'),
    { retryable: false, safeCode: 'UNREGISTERED' },
  );
  assert.deepEqual(
    classifyFcmErrorCode('messaging/message-rate-exceeded'),
    { retryable: true, safeCode: 'messaging/message-rate-exceeded' },
  );
  assert.deepEqual(
    classifyFcmErrorCode('messaging/mismatched-credential'),
    { retryable: false, safeCode: 'FCM_REJECTED' },
  );
});
