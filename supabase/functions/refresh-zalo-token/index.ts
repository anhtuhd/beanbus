import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const ZALO_TOKEN_ENDPOINT = 'https://oauth.zaloapp.com/v4/oa/access_token';
const ZALO_TIMEOUT_MS = 8_000;

type RefreshLease = {
  lease_id: string;
  refresh_token: string;
  version: number;
};

type ZaloTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function serviceRoleKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacyKey) return legacyKey;

  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (secretKey) return secretKey;

  throw new Error('Missing Supabase service role key');
}

async function matchesSecret(candidate: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  return left.every((byte, index) => byte === right[index]);
}

function jsonResponse(status: number, body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const suppliedSecret = request.headers.get('x-zalo-refresh-secret') ?? '';
  const expectedSecret = Deno.env.get('ZALO_REFRESH_JOB_SECRET')?.trim() ?? '';
  if (!expectedSecret || !(await matchesSecret(suppliedSecret, expectedSecret))) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    serviceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let lease: RefreshLease | null = null;

  try {
    const { data, error } = await supabase.rpc('claim_zalo_token_refresh');
    if (error) throw new Error('Unable to claim refresh lease');

    lease = Array.isArray(data) ? data[0] ?? null : data;
    if (!lease) return jsonResponse(204);

    const response = await fetch(ZALO_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        secret_key: requiredEnv('ZALO_APP_SECRET'),
      },
      body: new URLSearchParams({
        app_id: requiredEnv('ZALO_APP_ID'),
        grant_type: 'refresh_token',
        refresh_token: lease.refresh_token,
      }),
      signal: AbortSignal.timeout(ZALO_TIMEOUT_MS),
    });
    const tokenResult = await response.json().catch(() => null) as ZaloTokenResponse | null;
    const accessToken = tokenResult?.access_token;
    const refreshToken = tokenResult?.refresh_token;
    const expiresIn = Number(tokenResult?.expires_in);

    if (
      !response.ok ||
      typeof accessToken !== 'string' ||
      accessToken.length < 20 ||
      typeof refreshToken !== 'string' ||
      refreshToken.length < 20 ||
      !Number.isFinite(expiresIn) ||
      expiresIn < 60
    ) {
      throw new Error('Zalo rejected token refresh');
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1_000).toISOString();
    const { data: completed, error: completeError } = await supabase.rpc(
      'complete_zalo_token_refresh',
      {
        p_lease_id: lease.lease_id,
        p_expected_version: lease.version,
        p_access_token: accessToken,
        p_refresh_token: refreshToken,
        p_expires_at: expiresAt,
      },
    );
    if (completeError || completed !== true) {
      throw new Error('Unable to commit refreshed tokens');
    }

    console.info('refresh_zalo_token_completed', { version: lease.version + 1 });
    return jsonResponse(200, { refreshed: true, expiresAt });
  } catch (error) {
    if (lease) {
      await supabase.rpc('release_zalo_token_refresh', { p_lease_id: lease.lease_id });
    }
    console.error('refresh_zalo_token_failed', {
      reason: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'provider_timeout'
        : 'refresh_failed',
    });
    return jsonResponse(502, { error: 'Unable to refresh Zalo token' });
  }
});
