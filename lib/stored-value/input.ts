import { randomUUID } from 'node:crypto';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type StoredValueIntentInput = {
  itemId: string;
  idempotencyKey: string;
};

export function parseStoredValueIntentInput(value: unknown): { ok: true; data: StoredValueIntentInput } | { ok: false; error: 'INVALID_STORED_VALUE_INPUT' } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'INVALID_STORED_VALUE_INPUT' };
  const input = value as Record<string, unknown>;
  if (!isUuid(input.itemId) || !isUuid(input.idempotencyKey)) return { ok: false, error: 'INVALID_STORED_VALUE_INPUT' };
  return { ok: true, data: { itemId: input.itemId, idempotencyKey: input.idempotencyKey } };
}

export function createStoredValueIdempotencyKey(): string {
  return randomUUID();
}
