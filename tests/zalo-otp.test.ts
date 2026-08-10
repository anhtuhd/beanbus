import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildZaloTemplatePayload,
  parseZaloSendResult,
  resolveZaloRecipient,
} from '../supabase/functions/_shared/zalo-otp.ts';

test('uses the pending phone change before the current phone', () => {
  assert.equal(resolveZaloRecipient({
    phone: '+84937936688',
    new_phone: '+84987654321',
  }), '+84987654321');
});

test('accepts only normalized Vietnamese mobile recipients', () => {
  assert.equal(resolveZaloRecipient({ phone: '+84937936688' }), '+84937936688');
  assert.equal(resolveZaloRecipient({ phone: '0937936688' }), null);
  assert.equal(resolveZaloRecipient({ phone: '+84123456789' }), null);
  assert.equal(resolveZaloRecipient({ phone: '+84937936688', new_phone: 'invalid' }), null);
});

test('maps a Supabase OTP to the approved Zalo template contract', () => {
  assert.deepEqual(buildZaloTemplatePayload({
    phone: '+84937936688',
    otp: '561166',
    templateId: 'template-123',
    otpParam: 'otp',
    trackingId: '123e4567e89b12d3a456426614174000',
  }), {
    phone: '84937936688',
    template_id: 'template-123',
    template_data: { otp: '561166' },
    tracking_id: '123e4567e89b12d3a456426614174000',
  });
});

test('rejects malformed OTP and unsafe dynamic parameter names', () => {
  assert.throws(() => buildZaloTemplatePayload({
    phone: '+84937936688',
    otp: '12345',
    templateId: 'template-123',
    otpParam: 'otp',
    trackingId: 'tracking123',
  }));
  assert.throws(() => buildZaloTemplatePayload({
    phone: '+84937936688',
    otp: '123456',
    templateId: 'template-123',
    otpParam: '__proto__',
    trackingId: 'tracking123',
  }));
});

test('returns only safe Zalo delivery diagnostics', () => {
  assert.deepEqual(parseZaloSendResult({
    error: 0,
    message: 'Success',
    data: { msg_id: 'zalo-message-id', quota: { remainingQuota: '12' } },
  }), { ok: true, messageId: 'zalo-message-id' });

  assert.deepEqual(parseZaloSendResult({
    error: -124,
    message: 'Sensitive provider detail for +84937936688',
  }), { ok: false, errorCode: -124 });
});
