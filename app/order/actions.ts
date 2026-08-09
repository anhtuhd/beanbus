'use server';

import { parseCreateOrderInput } from '@/lib/orders/input';
import { getSepayConfig } from '@/lib/payments/sepay-config';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type CreateOrderResult =
  | {
      ok: true;
      order: {
        discountVnd: number;
        id: string;
        number: number;
        receipt: string;
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

  const { data: receiptData, error: receiptError } = await supabase.rpc('issue_order_receipt', {
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  const receipt = receiptData?.[0]?.receipt_token;
  if (receiptError || !receipt) return { ok: false, error: 'ORDER_RECEIPT_FAILED' };

  if (parsed.data.paymentMethod === 'sepay_qr') {
    try {
      const config = getSepayConfig();
      const admin = createAdminSupabaseClient();
      const { data: paymentData, error: paymentError } = await admin.rpc('create_sepay_payment', {
        p_order_id: order.order_id,
        p_receipt_token: receipt,
        p_bank_code: config.bankCode,
        p_account_number: config.accountNumber,
      });
      if (paymentError || !paymentData?.[0]) return { ok: false, error: 'PAYMENT_CREATION_FAILED' };
    } catch {
      return { ok: false, error: 'PAYMENT_CONFIGURATION_FAILED' };
    }
  }

  return {
    ok: true,
    order: {
      id: order.order_id,
      number: order.order_number,
      receipt,
      subtotalVnd: order.subtotal_vnd,
      discountVnd: order.discount_vnd,
      totalVnd: order.total_vnd,
    },
  };
}
