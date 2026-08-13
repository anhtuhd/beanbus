import { cert, getApps, initializeApp } from 'npm:firebase-admin@14.2.0/app';
import { getMessaging } from 'npm:firebase-admin@14.2.0/messaging';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { classifyFcmErrorCode, normalizeFcmHref } from '../_shared/fcm-delivery.ts';

type OutboxRow = {
  outbox_id: string;
  fid: string;
  payload: Record<string, unknown>;
};

type SafePayload = {
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  href: string;
  kind: string;
  tag: string;
};

type DeliveryError = Error & { retryable?: boolean; safeCode?: string };

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function json(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function supabaseClient() {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ??
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (!serviceKey) throw new Error('Missing Supabase service key');
  return createClient(requiredEnv('SUPABASE_URL'), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function firebaseApp() {
  const existing = getApps().find((app) => app.name === 'beanbus-fcm-worker');
  if (existing) return existing;

  let serviceAccount: Record<string, unknown>;
  try {
    const bytes = Uint8Array.from(
      atob(requiredEnv('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64')),
      (character) => character.charCodeAt(0),
    );
    serviceAccount = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid Firebase service account configuration');
  }
  return initializeApp({ credential: cert(serviceAccount) }, 'beanbus-fcm-worker');
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value
    : null;
}

function notificationPlainText(value: string): string {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)]|>)\s+/gm, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePayload(value: Record<string, unknown>): SafePayload | null {
  const titleVi = boundedString(value.titleVi, 180);
  const titleEn = boundedString(value.titleEn, 180);
  const bodyViValue = boundedString(value.bodyVi, 240);
  const bodyEnValue = boundedString(value.bodyEn, 240);
  const bodyVi = bodyViValue ? notificationPlainText(bodyViValue) : null;
  const bodyEn = bodyEnValue ? notificationPlainText(bodyEnValue) : null;
  const href = normalizeFcmHref(value.href);
  const kind = boundedString(value.kind, 80);
  const tag = boundedString(value.tag, 255);
  if (!titleVi || !titleEn || !bodyVi || !bodyEn || !href || !kind || !tag) return null;
  return { titleVi, titleEn, bodyVi, bodyEn, href, kind, tag };
}

function classifyFirebaseError(cause: unknown): DeliveryError {
  const code = typeof cause === 'object' && cause !== null && 'code' in cause &&
      typeof (cause as { code?: unknown }).code === 'string'
    ? (cause as { code: string }).code
    : 'messaging/unknown-error';
  const error = new Error('FCM_DELIVERY_FAILED') as DeliveryError;
  const classification = classifyFcmErrorCode(code);
  error.safeCode = classification.safeCode;
  error.retryable = classification.retryable;
  return error;
}

async function processRow(
  supabase: ReturnType<typeof supabaseClient>,
  row: OutboxRow,
): Promise<boolean> {
  const payload = parsePayload(row.payload);
  if (!payload) {
    const { data, error } = await supabase.rpc('fail_push_notification', {
      p_error_code: 'INVALID_PAYLOAD',
      p_outbox_id: row.outbox_id,
      p_retryable: false,
    });
    if (error || data !== true) throw new Error('PUSH_FAILURE_RECORD_FAILED');
    return false;
  }

  try {
    const providerMessageId = await getMessaging(firebaseApp()).send({
      fid: row.fid,
      data: payload,
      webpush: { headers: { Urgency: 'high' } },
    });
    const { data, error } = await supabase.rpc('complete_push_notification', {
      p_outbox_id: row.outbox_id,
      p_provider_message_id: providerMessageId,
    });
    if (error || data !== true) throw new Error('PUSH_COMPLETION_FAILED');
    return true;
  } catch (cause) {
    const deliveryError = cause instanceof Error && cause.message === 'PUSH_COMPLETION_FAILED'
      ? Object.assign(cause, { retryable: true, safeCode: 'PUSH_COMPLETION_FAILED' })
      : classifyFirebaseError(cause);
    const { data, error } = await supabase.rpc('fail_push_notification', {
      p_error_code: deliveryError.safeCode ?? 'FCM_DELIVERY_FAILED',
      p_outbox_id: row.outbox_id,
      p_retryable: deliveryError.retryable === true,
    });
    if (error || data !== true) throw new Error('PUSH_FAILURE_RECORD_FAILED');
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (request.headers.get('x-fcm-worker-secret') !== requiredEnv('FCM_WORKER_SECRET')) {
    return json(401, { error: 'Unauthorized' });
  }

  const mode = Deno.env.get('FCM_DELIVERY_MODE')?.trim().toLowerCase() ?? 'disabled';
  if (mode === 'disabled') return json(200, { disabled: true });
  if (mode !== 'allowlist' && mode !== 'enabled') {
    return json(503, { error: 'Invalid delivery mode' });
  }

  const supabase = supabaseClient();
  const allowlist = [...new Set(
    (Deno.env.get('FCM_ALLOWLIST_FIDS') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  )];
  if (mode === 'allowlist' && allowlist.length === 0) {
    return json(200, { claimed: 0, eligible: 0, sent: 0 });
  }
  const { data, error } = await supabase.rpc('claim_push_notification_batch', {
    p_allowed_fids: mode === 'allowlist' ? allowlist : null,
    p_limit: 50,
    p_worker_id: crypto.randomUUID(),
  });
  if (error) return json(503, { error: 'Unable to claim push queue' });

  const rows = (data ?? []) as OutboxRow[];
  let sent = 0;
  for (let index = 0; index < rows.length; index += 5) {
    const results = await Promise.all(rows.slice(index, index + 5).map((row) => processRow(supabase, row)));
    sent += results.filter(Boolean).length;
  }

  return json(200, { claimed: data?.length ?? 0, eligible: rows.length, sent });
});
