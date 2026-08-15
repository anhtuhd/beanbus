import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_PARTS = 3;

function secret(): string {
  const value = process.env.MEMBER_PASS_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('MEMBER_PASS_SECRET must be at least 32 characters.');
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function hashMemberPassNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

export function issueMemberPass(): { token: string; nonceHash: string; expiresAt: string } {
  const nonce = randomBytes(18).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = `${expiresAt}.${nonce}`;
  return { token: `${payload}.${sign(payload)}`, nonceHash: hashMemberPassNonce(nonce), expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export function verifyMemberPass(token: string): { nonceHash: string; expiresAt: number } | null {
  const parts = token.split('.');
  if (parts.length !== TOKEN_PARTS) return null;
  const [expiresText, nonce, signature] = parts;
  const expiresAt = Number(expiresText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;
  const expected = sign(`${expiresText}.${nonce}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return { nonceHash: hashMemberPassNonce(nonce), expiresAt };
}
