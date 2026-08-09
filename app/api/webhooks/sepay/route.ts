import { getSepayConfig } from '@/lib/payments/sepay-config';
import { parseSepayWebhook, verifySepayHmac } from '@/lib/payments/sepay';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 64 * 1024;

function failure(status: number) {
  return Response.json({ success: false }, { status });
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') return failure(404);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure(415);

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return failure(413);

  let config: ReturnType<typeof getSepayConfig>;
  try {
    config = getSepayConfig();
  } catch {
    return failure(503);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return failure(413);
  if (!verifySepayHmac({
    rawBody,
    secret: config.webhookSecret,
    signature: request.headers.get('x-sepay-signature'),
    timestamp: request.headers.get('x-sepay-timestamp'),
  })) return failure(401);

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return failure(400);
  }
  const event = parseSepayWebhook(rawPayload);
  if (!event) return failure(400);

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
  if (error) return failure(500);

  return Response.json({ success: true });
}
