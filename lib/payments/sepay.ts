import { createHmac, timingSafeEqual } from 'node:crypto';

export type SepayWebhook = {
  accountNumber: string;
  accumulated: number;
  code: string | null;
  content: string;
  description: string;
  gateway: string;
  id: number;
  referenceCode: string;
  subAccount: string;
  transactionAt: string;
  transactionDate: string;
  transferAmount: number;
  transferType: 'in' | 'out';
};

type VerifyHmacInput = {
  nowMs?: number;
  rawBody: string;
  secret: string;
  signature: string | null;
  timestamp: string | null;
};

function boundedText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.length > 0);
}

export function parseSepayWebhookBody(rawBody: string, contentType: string): unknown | null {
  if (contentType.startsWith('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  }
  if (!contentType.startsWith('application/x-www-form-urlencoded')) return null;

  const form = Object.fromEntries(new URLSearchParams(rawBody));
  return {
    ...form,
    id: Number(form.id),
    code: form.code || null,
    subAccount: form.subAccount ?? '',
    description: form.description ?? '',
    transferAmount: Number(form.transferAmount),
    accumulated: Number(form.accumulated),
    referenceCode: form.referenceCode ?? '',
  };
}

export function isSepayTestPayload(value: unknown): boolean {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Record<string, unknown>).id === 0;
}

export function verifySepayHmac({
  nowMs = Date.now(),
  rawBody,
  secret,
  signature,
  timestamp,
}: VerifyHmacInput): boolean {
  if (!secret || !signature || !timestamp || !/^\d{10}$/.test(timestamp)) return false;
  const signedAt = Number(timestamp);
  if (!Number.isSafeInteger(signedAt) || Math.abs(Math.floor(nowMs / 1000) - signedAt) > 300) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);
  return expectedBytes.length === signatureBytes.length && timingSafeEqual(expectedBytes, signatureBytes);
}

const BEANBUS_PAYMENT_CODE_PATTERN = /\bDH-[0-9]{6}[A-Za-z0-9]{6}\b/i;

export function resolveSepayPaymentCode(code: string | null, content: string): string | null {
  const explicitCode = code?.match(BEANBUS_PAYMENT_CODE_PATTERN)?.[0];
  const contentCode = content.match(BEANBUS_PAYMENT_CODE_PATTERN)?.[0];
  return (explicitCode ?? contentCode)?.toUpperCase() ?? null;
}

export function parseSepayWebhook(value: unknown): SepayWebhook | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const code = input.code === null ? null : input.code;

  if (!Number.isSafeInteger(input.id) || Number(input.id) < 0
    || !boundedText(input.gateway, 100)
    || !boundedText(input.transactionDate, 19)
    || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input.transactionDate)
    || !boundedText(input.accountNumber, 64)
    || !boundedText(input.subAccount, 100, true)
    || !(code === null || boundedText(code, 64))
    || !boundedText(input.content, 1000)
    || !['in', 'out'].includes(String(input.transferType))
    || !boundedText(input.description, 2000, true)
    || !Number.isSafeInteger(input.transferAmount) || Number(input.transferAmount) < 1
    || !Number.isSafeInteger(input.accumulated) || Number(input.accumulated) < 0
    || !boundedText(input.referenceCode, 200, true)) return null;

  const transactionAt = new Date(`${input.transactionDate.replace(' ', 'T')}+07:00`);
  if (!Number.isFinite(transactionAt.getTime())) return null;

  return {
    id: Number(input.id),
    gateway: input.gateway,
    transactionDate: input.transactionDate,
    transactionAt: transactionAt.toISOString(),
    accountNumber: input.accountNumber,
    subAccount: input.subAccount,
    code: code as string | null,
    content: input.content,
    transferType: input.transferType as SepayWebhook['transferType'],
    description: input.description,
    transferAmount: Number(input.transferAmount),
    accumulated: Number(input.accumulated),
    referenceCode: input.referenceCode,
  };
}

export function buildSepayQrUrl(input: {
  accountName?: string;
  accountNumber: string;
  amountVnd: number;
  bankCode: string;
  paymentCode: string;
}) {
  const url = new URL('https://vietqr.app/img');
  url.searchParams.set('acc', input.accountNumber);
  url.searchParams.set('bank', input.bankCode);
  url.searchParams.set('amount', String(input.amountVnd));
  url.searchParams.set('des', input.paymentCode);
  url.searchParams.set('template', 'compact');
  url.searchParams.set('showinfo', 'true');
  if (input.accountName) url.searchParams.set('holder', input.accountName);
  url.searchParams.set('store', 'BEANBUS');
  return url.toString();
}
