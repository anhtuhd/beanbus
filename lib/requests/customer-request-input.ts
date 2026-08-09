import { normalizeVietnameseMobile } from '../auth/input.ts';

export type CustomerRequestType = 'contact' | 'rsvp' | 'b2b_quote';

type CommonRequest = {
  consentToContact: true;
  email?: string;
  idempotencyKey: string;
  name: string;
  phone: string;
};

export type CustomerRequestInput =
  | (CommonRequest & { message: string; type: 'contact' })
  | (CommonRequest & { subjectReference: string; type: 'rsvp' })
  | (CommonRequest & {
      organization?: string;
      subjectReference?: string;
      type: 'b2b_quote';
      volumeRange: '10_30' | '30_100' | 'over_100';
    });

type ParseResult =
  | { data: CustomerRequestInput; ok: true }
  | { error: string; ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_ID = /^event-[a-z0-9][a-z0-9-]{0,92}$/;
const BEAN_ID = /^bean-[a-z0-9][a-z0-9-]{0,93}$/;
const VOLUME_RANGES = ['10_30', '30_100', 'over_100'] as const;

export function parseCustomerRequestInput(value: unknown): ParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'INVALID_REQUEST' };
  }

  const input = value as Record<string, unknown>;
  const type = String(input.type ?? '');
  if (!['contact', 'rsvp', 'b2b_quote'].includes(type)) {
    return { ok: false, error: 'INVALID_REQUEST_TYPE' };
  }

  const idempotencyKey = String(input.idempotencyKey ?? '');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? normalizeVietnameseMobile(input.phone) : null;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';

  if (!UUID.test(idempotencyKey)) return { ok: false, error: 'INVALID_IDEMPOTENCY_KEY' };
  if (name.length < 2 || name.length > 100 || !phone) return { ok: false, error: 'INVALID_CONTACT' };
  if (email && (email.length > 254 || !EMAIL.test(email))) return { ok: false, error: 'INVALID_EMAIL' };
  if (input.consentToContact !== true) return { ok: false, error: 'CONSENT_REQUIRED' };

  const common = {
    consentToContact: true as const,
    ...(email ? { email } : {}),
    idempotencyKey,
    name,
    phone,
  };

  if (type === 'contact') {
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (message.length < 10 || message.length > 2000) return { ok: false, error: 'INVALID_MESSAGE' };
    return { ok: true, data: { ...common, message, type: 'contact' } };
  }

  const subjectReference = typeof input.subjectReference === 'string' ? input.subjectReference.trim() : '';
  if (type === 'rsvp') {
    if (!EVENT_ID.test(subjectReference)) return { ok: false, error: 'INVALID_EVENT' };
    return { ok: true, data: { ...common, subjectReference, type: 'rsvp' } };
  }

  const organization = typeof input.organization === 'string' ? input.organization.trim() : '';
  const volumeRange = String(input.volumeRange ?? '');
  if (subjectReference && !BEAN_ID.test(subjectReference)) return { ok: false, error: 'INVALID_BEAN' };
  if (organization && (organization.length < 2 || organization.length > 150)) {
    return { ok: false, error: 'INVALID_ORGANIZATION' };
  }
  if (!VOLUME_RANGES.includes(volumeRange as (typeof VOLUME_RANGES)[number])) {
    return { ok: false, error: 'INVALID_VOLUME_RANGE' };
  }

  return {
    ok: true,
    data: {
      ...common,
      ...(organization ? { organization } : {}),
      ...(subjectReference ? { subjectReference } : {}),
      type: 'b2b_quote',
      volumeRange: volumeRange as '10_30' | '30_100' | 'over_100',
    },
  };
}
