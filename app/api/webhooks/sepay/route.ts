import { getSepayConfig } from '@/lib/payments/sepay-config';
import { parseSepayWebhook, verifySepayHmac } from '@/lib/payments/sepay';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalFailure,
  type OperationalReason,
} from '@/lib/observability/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 64 * 1024;

function failure(status: number, correlationId: string) {
  return Response.json(
    { success: false },
    { status, headers: { [CORRELATION_HEADER]: correlationId } }
  );
}

function rejectWebhook(status: number, correlationId: string, reason: OperationalReason) {
  logOperationalFailure({
    correlationId,
    event: status >= 500 ? 'webhook_failed' : 'webhook_rejected',
    level: status >= 500 ? 'error' : 'warn',
    operation: 'process_sepay_webhook',
    reason,
  });
  return failure(status, correlationId);
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request.headers.get(CORRELATION_HEADER));
  if (process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') return failure(404, correlationId);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return rejectWebhook(415, correlationId, 'unsupported_media_type');
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return rejectWebhook(413, correlationId, 'payload_too_large');
  }

  let config: ReturnType<typeof getSepayConfig>;
  try {
    config = getSepayConfig();
  } catch {
    return rejectWebhook(503, correlationId, 'configuration_error');
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return rejectWebhook(400, correlationId, 'invalid_payload');
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return rejectWebhook(413, correlationId, 'payload_too_large');
  }
  if (!verifySepayHmac({
    rawBody,
    secret: config.webhookSecret,
    signature: request.headers.get('x-sepay-signature'),
    timestamp: request.headers.get('x-sepay-timestamp'),
  })) return rejectWebhook(401, correlationId, 'invalid_signature');

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return rejectWebhook(400, correlationId, 'invalid_payload');
  }
  const event = parseSepayWebhook(rawPayload);
  if (!event) return rejectWebhook(400, correlationId, 'invalid_payload');

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.rpc('process_sepay_webhook', {
      p_provider_transaction_id: event.id,
      p_gateway: event.gateway,
      p_transaction_at: event.transactionAt,
      p_account_number: event.accountNumber,
      p_code: event.code,
      p_transfer_type: event.transferType,
      p_transfer_amount: event.transferAmount,
      p_reference_code: event.referenceCode,
      p_payload: rawPayload as Json,
    });
    if (error) return rejectWebhook(500, correlationId, 'database_error');
  } catch {
    return rejectWebhook(500, correlationId, 'configuration_error');
  }

  return Response.json(
    { success: true },
    { headers: { [CORRELATION_HEADER]: correlationId } }
  );
}
