import { normalizeVietnameseMobile } from '../auth/input.ts';

export type OrderItemInput = {
  optionIds: string[];
  productId: string;
  quantity: number;
  specialNote?: string;
};

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  fulfillment: 'pickup' | 'delivery';
  idempotencyKey: string;
  items: OrderItemInput[];
  note?: string;
  paymentMethod: 'cod' | 'sepay_qr';
  pointsToApply: number;
  pickupAt?: string;
  voucherCode?: string;
};

type ParseResult =
  | { data: CreateOrderInput; ok: true }
  | { error: string; ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseCreateOrderInput(value: unknown): ParseResult {
  if (!value || typeof value !== 'object') return { ok: false, error: 'INVALID_ORDER' };
  const input = value as Record<string, unknown>;
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  const customerPhone = typeof input.customerPhone === 'string'
    ? normalizeVietnameseMobile(input.customerPhone)
    : null;
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  const deliveryAddress = typeof input.deliveryAddress === 'string'
    ? input.deliveryAddress.trim()
    : '';
  const voucherCode = typeof input.voucherCode === 'string'
    ? input.voucherCode.trim().toUpperCase()
    : '';
  const pointsToApply = input.pointsToApply === undefined ? 0 : Number(input.pointsToApply);

  if (!UUID.test(String(input.idempotencyKey ?? ''))) return { ok: false, error: 'INVALID_IDEMPOTENCY_KEY' };
  if (customerName.length < 2 || customerName.length > 100 || !customerPhone) {
    return { ok: false, error: 'INVALID_CUSTOMER' };
  }
  if (note.length > 500 || !['pickup', 'delivery'].includes(String(input.fulfillment))) {
    return { ok: false, error: 'INVALID_FULFILLMENT' };
  }
  if (!['cod', 'sepay_qr'].includes(String(input.paymentMethod))) {
    return { ok: false, error: 'INVALID_PAYMENT_METHOD' };
  }
  if (!Number.isInteger(pointsToApply) || pointsToApply < 0 || pointsToApply > 10_000_000) {
    return { ok: false, error: 'INVALID_POINTS_PAYMENT' };
  }
  if (voucherCode && !/^[A-Z0-9-]{3,32}$/.test(voucherCode)) {
    return { ok: false, error: 'INVALID_VOUCHER' };
  }

  let pickupAt: string | undefined;
  if (input.fulfillment === 'pickup') {
    const parsedPickup = new Date(String(input.pickupAt ?? ''));
    if (!Number.isFinite(parsedPickup.getTime())) return { ok: false, error: 'INVALID_PICKUP' };
    pickupAt = parsedPickup.toISOString();
  } else if (deliveryAddress.length < 10 || deliveryAddress.length > 300) {
    return { ok: false, error: 'INVALID_DELIVERY' };
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    return { ok: false, error: 'INVALID_ITEMS' };
  }

  const items: OrderItemInput[] = [];
  for (const rawItem of input.items) {
    if (!rawItem || typeof rawItem !== 'object') return { ok: false, error: 'INVALID_ITEM' };
    const item = rawItem as Record<string, unknown>;
    const productId = String(item.productId ?? '');
    const specialNote = typeof item.specialNote === 'string' ? item.specialNote.trim() : '';
    const optionIds = item.optionIds;

    if (!CATALOG_ID.test(productId)
      || !Number.isInteger(item.quantity)
      || Number(item.quantity) < 1
      || Number(item.quantity) > 20
      || specialNote.length > 200
      || !Array.isArray(optionIds)
      || optionIds.length > 20
      || optionIds.some((id) => typeof id !== 'string' || !CATALOG_ID.test(id))) {
      return { ok: false, error: 'INVALID_ITEM' };
    }

    items.push({
      productId,
      quantity: Number(item.quantity),
      optionIds: [...new Set(optionIds as string[])],
      specialNote: specialNote || undefined,
    });
  }

  return {
    ok: true,
    data: {
      idempotencyKey: String(input.idempotencyKey),
      customerName,
      customerPhone,
      fulfillment: input.fulfillment as CreateOrderInput['fulfillment'],
      pickupAt,
      deliveryAddress: input.fulfillment === 'delivery' ? deliveryAddress : undefined,
      note: note || undefined,
      paymentMethod: input.paymentMethod as CreateOrderInput['paymentMethod'],
      pointsToApply,
      voucherCode: voucherCode || undefined,
      items,
    },
  };
}
