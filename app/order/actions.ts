'use server';

import { parseCreateOrderInput } from '@/lib/orders/input';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { getSepayConfig } from '@/lib/payments/sepay-config';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { verifyFormCaptcha } from '@/lib/security/turnstile';
import { linkGuestOrderNotifications } from '@/lib/notifications/guest-session';

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
        pointsApplied: number;
        cashDueVnd: number;
      };
    }
  | { error: string; ok: false; reference?: string };

export async function createProductionOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = parseCreateOrderInput(input);
  if (!parsed.ok) return parsed;
  const captcha = await verifyFormCaptcha(input);
  if (!captcha.ok) {
    const correlationId = await getRequestCorrelationId();
    logOperationalFailure({
      correlationId,
      event: 'order_failed',
      operation: 'create_order',
      reason: captcha.reason,
    });
    return {
      ok: false,
      error: captcha.reason === 'configuration_error' ? 'BOT_CHECK_UNAVAILABLE' : 'BOT_CHECK_FAILED',
      reference: captcha.reason === 'configuration_error' ? correlationId : undefined,
    };
  }
  if (parsed.data.paymentMethod === 'sepay_qr' && process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') {
    return { ok: false, error: 'PAYMENT_METHOD_UNAVAILABLE' };
  }
  if (parsed.data.pointsToApply > 0 && process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT !== 'true') {
    return { ok: false, error: 'POINTS_PAYMENT_UNAVAILABLE' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_server_priced_order_v2', {
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
    p_points_to_apply: parsed.data.pointsToApply,
  });
  const order = data?.[0];

  if (error || !order) {
    logOperationalFailure({
      correlationId,
      event: 'order_failed',
      operation: 'create_order',
      reason: error ? 'database_error' : 'missing_result',
    });
    return { ok: false, error: 'ORDER_CREATION_FAILED', reference: correlationId };
  }

  const receipt = order.receipt_token;
  if (!receipt) {
    logOperationalFailure({
      correlationId,
      event: 'order_failed',
      operation: 'issue_order_receipt',
      reason: 'missing_result',
    });
    try {
      await createAdminSupabaseClient().rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
    } catch {
      // The order remains auditable; the expiry/compensation path can settle it.
    }
    return { ok: false, error: 'ORDER_RECEIPT_FAILED', reference: correlationId };
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    try {
      await linkGuestOrderNotifications(order.order_id);
    } catch {
      // Guest notifications are optional and must never block checkout.
    }
  }

  if (parsed.data.paymentMethod === 'sepay_qr' && order.cash_due_vnd > 0) {
    let config;
    try {
      config = getSepayConfig();
    } catch {
      logOperationalFailure({
        correlationId,
        event: 'payment_failed',
        operation: 'create_payment',
        reason: 'configuration_error',
      });
      try {
        await createAdminSupabaseClient().rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
      } catch {
        // The order remains auditable; the service retry/expiry path can settle it.
      }
      return { ok: false, error: 'PAYMENT_CONFIGURATION_FAILED', reference: correlationId };
    }

    const admin = createAdminSupabaseClient();
    let paymentCallFailed = false;
    try {
      const { data: paymentData, error: paymentError } = await admin.rpc('create_sepay_payment', {
        p_order_id: order.order_id,
        p_receipt_token: receipt,
        p_bank_code: config.bankCode,
        p_account_number: config.accountNumber,
      });
      paymentCallFailed = Boolean(
        paymentError
        || !paymentData?.[0]
        || paymentData[0].amount_vnd !== order.cash_due_vnd
        || !['pending', 'paid'].includes(paymentData[0].payment_status)
      );
    } catch {
      paymentCallFailed = true;
    }

    if (paymentCallFailed) {
      const { data: existingPayment, error: paymentLookupError } = await admin
        .from('payments')
        .select('status, amount_vnd')
        .eq('order_id', order.order_id)
        .maybeSingle();
      const paymentWasCreated = !paymentLookupError
        && existingPayment
        && existingPayment.amount_vnd === order.cash_due_vnd
        && ['pending', 'paid'].includes(existingPayment.status);

      if (!paymentWasCreated) {
        logOperationalFailure({
          correlationId,
          event: 'payment_failed',
          operation: 'create_payment',
          reason: paymentLookupError ? 'payment_lookup_failed' : 'database_error',
        });
        if (!paymentLookupError) {
          await admin.rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
        }
        return { ok: false, error: 'PAYMENT_CREATION_FAILED', reference: correlationId };
      }
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
      pointsApplied: order.points_applied,
      cashDueVnd: order.cash_due_vnd,
    },
  };
}
