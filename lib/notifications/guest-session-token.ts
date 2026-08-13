const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_VERSION = 'v1';

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const decoded = Buffer.from(value, 'base64url');
    const bytes = new Uint8Array(decoded.byteLength);
    bytes.set(decoded);
    return bytes;
  } catch {
    return null;
  }
}

async function importSecret(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('GUEST_NOTIFICATION_SECRET must contain at least 32 characters.');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createGuestSessionToken(sessionId: string, secret: string): Promise<string> {
  if (!UUID_PATTERN.test(sessionId)) throw new Error('Invalid guest notification session id.');
  const payload = `${TOKEN_VERSION}.${sessionId.toLowerCase()}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importSecret(secret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGuestSessionToken(token: string, secret: string): Promise<string | null> {
  const [version, sessionId, encodedSignature, extra] = token.split('.');
  if (extra !== undefined || version !== TOKEN_VERSION || !UUID_PATTERN.test(sessionId ?? '')) return null;
  const signature = base64UrlToBytes(encodedSignature ?? '');
  if (!signature || signature.byteLength !== 32) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await importSecret(secret),
      signature,
      new TextEncoder().encode(`${version}.${sessionId.toLowerCase()}`),
    );
    return valid ? sessionId.toLowerCase() : null;
  } catch {
    return null;
  }
}
