const VIETNAM_MOBILE_NUMBER = /^\+84[35789]\d{8}$/;
const SIX_DIGIT_OTP = /^\d{6}$/;
const SAFE_TEMPLATE_PARAMETER = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SAFE_TRACKING_ID = /^[A-Za-z0-9_-]{1,64}$/;

type HookUser = {
  phone?: unknown;
  new_phone?: unknown;
};

type ZaloTemplatePayloadInput = {
  phone: string;
  otp: string;
  templateId: string;
  otpParam: string;
  trackingId: string;
};

type ZaloTemplatePayload = {
  phone: string;
  template_id: string;
  template_data: Record<string, string>;
  tracking_id: string;
};

export type ZaloSendResult =
  | { ok: true; messageId: string }
  | { ok: false; errorCode: number | null };

export function resolveZaloRecipient(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const { phone, new_phone: newPhone } = user as HookUser;
  const candidate = newPhone !== undefined && newPhone !== null ? newPhone : phone;

  return typeof candidate === 'string' && VIETNAM_MOBILE_NUMBER.test(candidate) ? candidate : null;
}

export function buildZaloTemplatePayload({
  phone,
  otp,
  templateId,
  otpParam,
  trackingId,
}: ZaloTemplatePayloadInput): ZaloTemplatePayload {
  if (!VIETNAM_MOBILE_NUMBER.test(phone)) {
    throw new Error('Invalid Vietnamese mobile number');
  }
  if (!SIX_DIGIT_OTP.test(otp)) {
    throw new Error('Invalid OTP');
  }
  if (!templateId.trim()) {
    throw new Error('Missing Zalo template ID');
  }
  if (!SAFE_TEMPLATE_PARAMETER.test(otpParam)) {
    throw new Error('Invalid Zalo template parameter');
  }
  if (!SAFE_TRACKING_ID.test(trackingId)) {
    throw new Error('Invalid tracking ID');
  }

  return {
    phone: phone.slice(1),
    template_id: templateId,
    template_data: { [otpParam]: otp },
    tracking_id: trackingId,
  };
}

export function parseZaloSendResult(value: unknown): ZaloSendResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, errorCode: null };
  }

  const result = value as {
    error?: unknown;
    data?: { msg_id?: unknown } | null;
  };
  const errorCode = typeof result.error === 'number' && Number.isFinite(result.error)
    ? result.error
    : null;
  const messageId = result.data?.msg_id;

  if (errorCode === 0 && typeof messageId === 'string' && messageId.length > 0) {
    return { ok: true, messageId };
  }

  return { ok: false, errorCode };
}
