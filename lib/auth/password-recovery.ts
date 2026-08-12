export const PASSWORD_RECOVERY_COOKIE = 'beanbus_password_recovery';
export const PASSWORD_RECOVERY_MAX_AGE = 10 * 60;

function getRecoverySecret(): string | null {
  return process.env.PASSWORD_RECOVERY_SECRET?.trim() || null;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCodePoint(...new Uint8Array(bytes));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): Uint8Array {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
}

async function sign(payload: string): Promise<ArrayBuffer> {
  const secret = getRecoverySecret();
  if (!secret) throw new Error('Missing PASSWORD_RECOVERY_SECRET');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
}

export async function createRecoveryCapability(userId: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + PASSWORD_RECOVERY_MAX_AGE;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${toBase64Url(await sign(payload))}`;
}

export async function verifyRecoveryCapability(value: string | undefined, userId: string): Promise<boolean> {
  if (!value || !getRecoverySecret()) return false;
  const [capabilityUserId, expiresAtText, signature] = value.split('.');
  const expiresAt = Number(expiresAtText);
  if (
    capabilityUserId !== userId ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !signature
  ) return false;

  try {
    const payload = `${capabilityUserId}.${expiresAtText}`;
    const secret = getRecoverySecret();
    if (!secret) return false;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature).buffer as ArrayBuffer,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}
