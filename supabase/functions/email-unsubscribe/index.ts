import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hexToBytes(value: string): ArrayBuffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid signature');
  return Uint8Array.from(value.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)))
    .buffer as ArrayBuffer;
}

function base64UrlDecode(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') +
    '='.repeat((4 - value.length % 4) % 4);
  return atob(padded);
}

async function verifyToken(token: string): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = `${parts[0]}.${parts[1]}`;
  const email = base64UrlDecode(parts[0]);
  const expiresAt = Number(parts[1]);
  if (!email || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired token');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('EMAIL_UNSUBSCRIBE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(parts[2]),
    new TextEncoder().encode(payload),
  );
  if (!valid) throw new Error('Invalid signature');
  return email.toLowerCase();
}

function html(status: number, message: string) {
  return new Response(
    `<main style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto"><h1>Beanbus</h1><p>${message}</p></main>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
}

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'POST') return html(405, 'Method not allowed');
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return html(400, 'Liên kết hủy đăng ký không hợp lệ.');
    const email = await verifyToken(token);
    if (request.method === 'GET') {
      const action = `${new URL(request.url).pathname}?token=${encodeURIComponent(token)}`;
      return html(
        200,
        `<p>Bạn có muốn hủy email sự kiện và tin cửa hàng cho ${
          escapeHtml(email)
        }?</p><form method="post" action="${
          escapeHtml(action)
        }"><button type="submit">Xác nhận hủy đăng ký</button></form>`,
      );
    }
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ??
      Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
    if (!serviceKey) return html(503, 'Tạm thời không thể cập nhật lựa chọn email.');
    const supabase = createClient(requiredEnv('SUPABASE_URL'), serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.rpc('revoke_email_subscription', { p_email: email });
    if (error) return html(503, 'Tạm thời không thể cập nhật lựa chọn email.');
    return html(
      200,
      'Bạn đã hủy nhận email sự kiện và tin cửa hàng. Email liên quan đến đơn hàng vẫn có thể được gửi.',
    );
  } catch {
    return html(400, 'Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.');
  }
});
