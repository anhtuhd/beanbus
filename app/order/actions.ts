'use server';

import { parseCreateOrderInput } from '@/lib/orders/input';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type CreateOrderResult =
  | {
      ok: true;
      order: {
        discountVnd: number;
        id: string;
        number: number;
        subtotalVnd: number;
        totalVnd: number;
      };
    }
  | { error: string; ok: false };

export async function createProductionOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = parseCreateOrderInput(input);
  if (!parsed.ok) return parsed;
  if (parsed.data.paymentMethod === 'sepay_qr' && process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') {
    return { ok: false, error: 'PAYMENT_METHOD_UNAVAILABLE' };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_server_priced_order', {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_customer_name: parsed.data.customerName,
    p_customer_phone: parsed.data.customerPhone,
    p_fulfillment: parsed.data.fulfillment,
    p_pickup_at: parsed.data.pickupAt ?? null,
    p_delivery_address: parsed.data.deliveryAddress ?? null,
    p_note: parsed.data.note ?? null,
    p_payment_method: parsed.data.paymentMethod,
    p_voucher_code: parsed.data.voucherCode ?? null,
    p_items: parsed.data.items,
  });
  const order = data?.[0];

  if (error || !order) return { ok: false, error: 'ORDER_CREATION_FAILED' };

  return {
    ok: true,
    order: {
      id: order.order_id,
      number: order.order_number,
      subtotalVnd: order.subtotal_vnd,
      discountVnd: order.discount_vnd,
      totalVnd: order.total_vnd,
    },
  };
}
