import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  buildZaloTemplatePayload,
  parseZaloSendResult,
  resolveZaloRecipient,
} from '../_shared/zalo-otp.ts';

const ZALO_TEMPLATE_ENDPOINT = 'https://business.openapi.zalo.me/message/template';
const ZALO_TIMEOUT_MS = 3_500;
const TOKEN_LOOKUP_TIMEOUT_MS = 750;

type HookPayload = {
  user?: unknown;
  sms?: { otp?: unknown };
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

function jsonResponse(status: number, message?: string): Response {
  return new Response(message ? JSON.stringify({ error: message }) : '{}', {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse(405, 'Method not allowed');

  const trackingId = crypto.randomUUID().replaceAll('-', '');
  let rawBody: string;
  let payload: HookPayload;

  try {
    rawBody = await request.text();
    const hookSecret = requiredEnv('SEND_SMS_HOOK_SECRET').replace(/^v1,whsec_/, '');
    const webhook = new Webhook(hookSecret);
    payload = webhook.verify(
      rawBody,
      Object.fromEntries(request.headers),
    ) as HookPayload;
  } catch {
    console.warn('send_zalo_otp_rejected', { trackingId, reason: 'invalid_signature' });
    return jsonResponse(401, 'Invalid hook signature');
  }

  try {
    const phone = resolveZaloRecipient(payload.user);
    const otp = payload.sms?.otp;
    if (!phone || typeof otp !== 'string') {
      console.error('send_zalo_otp_rejected', { trackingId, reason: 'invalid_hook_payload' });
      return jsonResponse(400, 'Invalid hook payload');
    }

    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      serviceRoleKey(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: accessToken, error: tokenError } = await supabase
      .rpc('get_zalo_access_token')
      .abortSignal(AbortSignal.timeout(TOKEN_LOOKUP_TIMEOUT_MS));
    if (tokenError || typeof accessToken !== 'string' || !accessToken) {
      console.error('send_zalo_otp_failed', { trackingId, reason: 'access_token_unavailable' });
      return jsonResponse(503, 'OTP delivery is unavailable');
    }

    const providerPayload = buildZaloTemplatePayload({
      phone,
      otp,
      templateId: requiredEnv('ZALO_TEMPLATE_ID'),
      otpParam: requiredEnv('ZALO_OTP_PARAM'),
      trackingId,
    });
    const providerResponse = await fetch(ZALO_TEMPLATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        access_token: accessToken,
      },
      body: JSON.stringify(providerPayload),
      signal: AbortSignal.timeout(ZALO_TIMEOUT_MS),
    });
    const providerResult = parseZaloSendResult(await providerResponse.json().catch(() => null));

    if (!providerResponse.ok || !providerResult.ok) {
      console.error('send_zalo_otp_failed', {
        trackingId,
        reason: 'provider_rejected',
        providerStatus: providerResponse.status,
        errorCode: providerResult.ok ? null : providerResult.errorCode,
      });
      return jsonResponse(502, 'Unable to deliver OTP');
    }

    console.info('send_zalo_otp_delivered', {
      trackingId,
      messageId: providerResult.messageId,
    });
    return jsonResponse(200);
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'provider_timeout'
      : 'hook_processing_failed';
    console.error('send_zalo_otp_failed', { trackingId, reason });
    return jsonResponse(reason === 'provider_timeout' ? 504 : 500, 'Unable to deliver OTP');
  }
});
