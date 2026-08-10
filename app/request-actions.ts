'use server';

import { getAppMode } from '@/lib/env';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { parseCustomerRequestInput, type CustomerRequestType } from '@/lib/requests/customer-request-input';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type CreateCustomerRequestResult =
  | {
      ok: true;
      request: {
        reference: string;
        status: 'pending';
        type: CustomerRequestType;
      };
    }
  | { error: string; ok: false; reference?: string };

const REFERENCE_PREFIX: Record<CustomerRequestType, string> = {
  contact: 'CT',
  rsvp: 'EV',
  b2b_quote: 'BQ',
};

export async function createCustomerRequest(input: unknown): Promise<CreateCustomerRequestResult> {
  if (getAppMode() !== 'production') return { ok: false, error: 'PRODUCTION_MODE_REQUIRED' };

  const parsed = parseCustomerRequestInput(input);
  if (!parsed.ok) return parsed;

  const correlationId = await getRequestCorrelationId();
  const data = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { data: rows, error } = await supabase.rpc('create_customer_request', {
    p_idempotency_key: data.idempotencyKey,
    p_request_type: data.type,
    p_contact_name: data.name,
    p_contact_phone: data.phone,
    p_contact_email: data.email ?? null,
    p_subject_reference: 'subjectReference' in data ? data.subjectReference ?? null : null,
    p_organization: 'organization' in data ? data.organization ?? null : null,
    p_volume_range: 'volumeRange' in data ? data.volumeRange : null,
    p_message: 'message' in data ? data.message : null,
    p_consent_to_contact: data.consentToContact,
  });
  const request = rows?.[0];
  if (error || !request) {
    logOperationalFailure({
      correlationId,
      event: 'customer_request_failed',
      operation: 'create_customer_request',
      reason: error ? 'database_error' : 'missing_result',
    });
    const errorCode = error?.message.includes('EVENT_FULL')
      ? 'EVENT_FULL'
      : error?.message.includes('EVENT_CLOSED')
        ? 'EVENT_CLOSED'
        : error?.message.includes('INVALID_EVENT')
          ? 'INVALID_EVENT'
          : 'REQUEST_CREATION_FAILED';
    return { ok: false, error: errorCode, reference: correlationId };
  }
  if (!['contact', 'rsvp', 'b2b_quote'].includes(request.created_request_type)) {
    logOperationalFailure({
      correlationId,
      event: 'customer_request_failed',
      operation: 'create_customer_request',
      reason: 'missing_result',
    });
    return { ok: false, error: 'INVALID_REQUEST_RECEIPT', reference: correlationId };
  }

  const type = request.created_request_type as CustomerRequestType;
  return {
    ok: true,
    request: {
      reference: `${REFERENCE_PREFIX[type]}-${new Date().getFullYear()}-${String(request.request_number).padStart(6, '0')}`,
      status: 'pending',
      type,
    },
  };
}
