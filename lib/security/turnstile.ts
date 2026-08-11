type Environment = Record<string, string | undefined>;

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;

export type FormCaptchaCheck =
  | { ok: true }
  | { ok: false; reason: 'configuration_error' | 'invalid_payload' };

type SiteverifyResponse = { success?: unknown };

export function isFormCaptchaEnabled(env: Environment = process.env): boolean {
  return env.NEXT_PUBLIC_ENABLE_FORM_CAPTCHA === 'true';
}

function getFormCaptchaSecret(env: Environment): string {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || secret.length < 16) throw new Error('Invalid TURNSTILE_SECRET_KEY');
  return secret;
}

export async function verifyTurnstileToken(
  token: string,
  options: { env?: Environment; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const normalizedToken = token.trim();
  if (!normalizedToken || normalizedToken.length > MAX_TOKEN_LENGTH) return false;

  const secret = getFormCaptchaSecret(options.env ?? process.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: normalizedToken }),
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const result = await response.json() as SiteverifyResponse;
    return result.success === true;
  } catch {
    return false;
  }
}

export async function verifyFormCaptcha(input: unknown): Promise<FormCaptchaCheck> {
  if (!isFormCaptchaEnabled()) return { ok: true };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const token = (input as Record<string, unknown>).turnstileToken;
  if (typeof token !== 'string' || !token.trim() || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'invalid_payload' };
  }

  try {
    return (await verifyTurnstileToken(token))
      ? { ok: true }
      : { ok: false, reason: 'invalid_payload' };
  } catch {
    return { ok: false, reason: 'configuration_error' };
  }
}
