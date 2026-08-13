import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

type OutboxRow = {
  id: string;
  notification_id: string;
  recipient_email: string;
  attempt_count: number;
};

type NotificationRow = {
  kind:
    | 'order_created'
    | 'order_status_changed'
    | 'order_payment_changed'
    | 'event_published'
    | 'store_announcement'
    | 'booking_request_created'
    | 'booking_request_status_changed'
    | 'customer_request_created'
    | 'customer_request_status_changed';
  title_vi: string;
  body_vi: string;
  href: string | null;
};

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[character] ?? character);
}

function renderNotificationInlineHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
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

function renderNotificationRichTextHtml(value: string): string {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextList: 'ul' | 'ol' = unordered ? 'ul' : 'ol';
      if (list !== nextList) {
        closeList();
        list = nextList;
        html.push(`<${list}>`);
      }
      html.push(`<li>${renderNotificationInlineHtml((unordered ?? ordered)?.[1] ?? '')}</li>`);
      continue;
    }
    closeList();
    const quote = line.match(/^\s*>\s?(.*)$/);
    html.push(quote
      ? `<blockquote style="border-left:3px solid #f57f2f;margin:12px 0;padding:8px 12px">${renderNotificationInlineHtml(quote[1])}</blockquote>`
      : `<p>${renderNotificationInlineHtml(line.trim())}</p>`);
  }
  closeList();
  return html.join('');
}

function base64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function unsubscribeToken(email: string): Promise<string> {
  const payload = `${base64Url(email)}.${Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('EMAIL_UNSUBSCRIBE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${hex(signature)}`;
}

function supabaseClient() {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ??
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (!serviceKey) throw new Error('Missing Supabase service key');
  return createClient(requiredEnv('SUPABASE_URL'), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendEmail(outbox: OutboxRow, notification: NotificationRow): Promise<string> {
  const siteUrl = requiredEnv('APP_SITE_URL').replace(/\/$/, '');
  const functionUrl = `${
    requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  }/functions/v1/email-unsubscribe`;
  const unsubscribe =
    notification.kind === 'event_published' || notification.kind === 'store_announcement'
      ? `${functionUrl}?token=${encodeURIComponent(await unsubscribeToken(outbox.recipient_email))}`
      : null;
  const href = notification.href ? `${siteUrl}${notification.href}` : siteUrl;
  const title = escapeHtml(notification.title_vi);
  const body = renderNotificationRichTextHtml(notification.body_vi);
  const plainBody = notificationPlainText(notification.body_vi);
  const isMarketingNotification = notification.kind === 'event_published' ||
    notification.kind === 'store_announcement';
  const link = `<p><a href="${escapeHtml(href)}">Xem trên Beanbus</a></p>`;
  const footer = unsubscribe
    ? `<p style="font-size:12px;color:#756960"><a href="${
      escapeHtml(unsubscribe)
    }">Hủy nhận email sự kiện và tin cửa hàng</a></p>`
    : '';
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`,
        'content-type': 'application/json',
        'Idempotency-Key': `notification/${outbox.notification_id}`,
      },
      body: JSON.stringify({
        from: isMarketingNotification
          ? requiredEnv('RESEND_NEWS_FROM')
          : requiredEnv('RESEND_NOTIFY_FROM'),
        to: [outbox.recipient_email],
        subject: notification.title_vi,
        headers: unsubscribe
          ? {
            'List-Unsubscribe': `<${unsubscribe}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
          : undefined,
        html:
          `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${title}</h2>${body}${link}${footer}</div>`,
        text: `${notification.title_vi}\n\n${plainBody}\n\n${href}${
          unsubscribe ? `\n\nHủy nhận email: ${unsubscribe}` : ''
        }`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    const error = new Error(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'RESEND_TIMEOUT'
        : 'RESEND_NETWORK_ERROR',
    );
    (error as Error & { retryable?: boolean }).retryable = true;
    throw error;
  }
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof result?.id !== 'string') {
    const error = new Error(`RESEND_${response.status}`);
    (error as Error & { retryable?: boolean }).retryable = response.status === 429 ||
      response.status >= 500;
    throw error;
  }
  return result.id;
}

async function processOutboxRow(
  supabase: ReturnType<typeof supabaseClient>,
  outbox: OutboxRow,
): Promise<boolean> {
  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .select('kind, title_vi, body_vi, href')
    .eq('id', outbox.notification_id)
    .maybeSingle();
  if (notificationError || !notification) {
    const { data: failureData, error: failureError } = await supabase.rpc('fail_notification_email', {
      p_outbox_id: outbox.id,
      p_retryable: false,
      p_error_code: 'NOTIFICATION_NOT_FOUND',
    });
    if (failureError || failureData !== true) throw new Error('EMAIL_FAILURE_RECORD_FAILED');
    return false;
  }

  try {
    const providerMessageId = await sendEmail(outbox, notification as NotificationRow);
    const { data: completed, error: completionError } = await supabase.rpc(
      'complete_notification_email',
      {
        p_outbox_id: outbox.id,
        p_provider_message_id: providerMessageId,
      },
    );
    if (completionError || completed !== true) {
      const error = new Error(
        completionError ? 'EMAIL_COMPLETION_FAILED' : 'EMAIL_COMPLETION_REJECTED',
      ) as Error & {
        retryable?: boolean;
      };
      error.retryable = true;
      throw error;
    }
    return true;
  } catch (error) {
    const { data: failureData, error: failureError } = await supabase.rpc('fail_notification_email', {
      p_outbox_id: outbox.id,
      p_retryable: error instanceof Error &&
        (error as Error & { retryable?: boolean }).retryable === true,
      p_error_code: error instanceof Error ? error.message : 'RESEND_REQUEST_FAILED',
    });
    if (failureError || failureData !== true) throw new Error('EMAIL_FAILURE_RECORD_FAILED');
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (
    request.headers.get('x-notification-worker-secret') !==
      requiredEnv('NOTIFICATION_WORKER_SECRET')
  ) {
    return json(401, { error: 'Unauthorized' });
  }
  if (Deno.env.get('NOTIFICATION_EMAIL_MODE') !== 'enabled') {
    return json(200, { disabled: true });
  }

  const supabase = supabaseClient();
  const workerId = crypto.randomUUID();
  const { data: outboxRows, error: claimError } = await supabase.rpc(
    'claim_notification_email_batch',
    {
      p_limit: 50,
      p_worker_id: workerId,
    },
  );
  if (claimError) return json(503, { error: 'Unable to claim email queue' });

  let sent = 0;
  const rows = (outboxRows ?? []) as OutboxRow[];
  for (let index = 0; index < rows.length; index += 5) {
    const results = await Promise.all(
      rows.slice(index, index + 5).map((outbox) => processOutboxRow(supabase, outbox)),
    );
    sent += results.filter(Boolean).length;
  }

  return json(200, { claimed: outboxRows?.length ?? 0, sent });
});
