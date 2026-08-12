import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { Webhook } from 'npm:svix@1.75.0';

type ResendEvent = {
  type?: unknown;
  created_at?: unknown;
  data?: { email_id?: unknown; message_id?: unknown };
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function response(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_WEBHOOK_BODY_BYTES) {
      return null;
    }
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return response(415, { error: 'Unsupported media type' });
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) return response(413, { error: 'Webhook body too large' });
  let event: ResendEvent;
  try {
    const webhook = new Webhook(requiredEnv('RESEND_WEBHOOK_SECRET'));
    event = webhook.verify(rawBody, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    }) as ResendEvent;
  } catch {
    return response(400, { error: 'Invalid webhook signature' });
  }

  const eventId = request.headers.get('svix-id');
  const eventType = event.type;
  const providerMessageId = event.data?.email_id ?? event.data?.message_id;
  if (
    typeof eventId !== 'string' || typeof eventType !== 'string' ||
    typeof providerMessageId !== 'string'
  ) {
    return response(400, { error: 'Invalid webhook payload' });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ??
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (!serviceKey) return response(503, { error: 'Webhook processing unavailable' });
  const supabase = createClient(requiredEnv('SUPABASE_URL'), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc('record_email_delivery_event', {
    p_provider_event_id: eventId,
    p_provider_message_id: providerMessageId,
    p_event_type: eventType,
    p_occurred_at: typeof event.created_at === 'string'
      ? event.created_at
      : new Date().toISOString(),
  });
  if (error) return response(503, { error: 'Unable to record webhook' });
  return response(200, { received: true });
});
