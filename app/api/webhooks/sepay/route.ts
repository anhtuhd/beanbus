import { getSepayConfig } from '@/lib/payments/sepay-config';
import { parseSepayWebhook, parseSepayWebhookBody, resolveSepayPaymentCode, verifySepayHmac } from '@/lib/payments/sepay';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalEvent,
  logOperationalFailure,
  type OperationalReason,
} from '@/lib/observability/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isStoredValueConfigured } from '@/lib/stored-value/config';
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
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')
    && !contentType.startsWith('application/x-www-form-urlencoded')) {
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

  const rawPayload = parseSepayWebhookBody(rawBody, contentType);
  if (rawPayload === null) return rejectWebhook(400, correlationId, 'invalid_payload');
  const event = parseSepayWebhook(rawPayload);
  if (!event) return rejectWebhook(400, correlationId, 'invalid_payload');

  try {
    const admin = createAdminSupabaseClient();
    const paymentCode = resolveSepayPaymentCode(event.code, event.content);
    const storedValueCode = typeof event.code === 'string' ? event.code.trim() : null;
    const isStoredValueCode = typeof storedValueCode === 'string' && /^B[TF][0-9]+$/i.test(storedValueCode);
    const rpcCode = isStoredValueCode ? storedValueCode : paymentCode;
    if (isStoredValueCode && !isStoredValueConfigured()) {
      return rejectWebhook(404, correlationId, 'feature_disabled');
    }
    const result = isStoredValueCode
      ? await admin.rpc('process_stored_value_webhook', {
        p_provider_transaction_id: event.id,
        p_gateway: event.gateway,
        p_transaction_at: event.transactionAt,
        p_account_number: event.accountNumber,
        p_code: rpcCode,
        p_transfer_type: event.transferType,
        p_transfer_amount: event.transferAmount,
        p_reference_code: event.referenceCode,
        p_payload: rawPayload as Json,
      })
      : await admin.rpc('process_sepay_webhook', {
        p_provider_transaction_id: event.id,
        p_gateway: event.gateway,
        p_transaction_at: event.transactionAt,
        p_account_number: event.accountNumber,
        p_code: rpcCode,
        p_transfer_type: event.transferType,
        p_transfer_amount: event.transferAmount,
        p_reference_code: event.referenceCode,
        p_payload: rawPayload as Json,
      });
    if (result.error) return rejectWebhook(500, correlationId, 'database_error');
    const outcome = result.data?.[0]?.outcome;
    if (outcome !== 'processed' && outcome !== 'duplicate' && outcome !== 'rejected') {
      return rejectWebhook(500, correlationId, 'missing_result');
    }
    logOperationalEvent({
      correlationId,
      event: 'webhook_processed',
      level: outcome === 'rejected' ? 'warn' : 'info',
      operation: 'process_sepay_webhook',
      metrics: { outcome, storedValue: isStoredValueCode },
    });
  } catch {
    return rejectWebhook(500, correlationId, 'configuration_error');
  }

  return Response.json(
    { success: true },
    { headers: { [CORRELATION_HEADER]: correlationId } }
  );
}
