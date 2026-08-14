'use server';

import { getCurrentProfile } from '@/lib/auth/session';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { buildSepayQrUrl } from '@/lib/payments/sepay';
import { getSepayConfig } from '@/lib/payments/sepay-config';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isStoredValueConfigured } from '@/lib/stored-value/config';
import { parseStoredValueIntentInput } from '@/lib/stored-value/input';
import type { StoredValueKind } from '@/lib/stored-value/queries';
import type { Database } from '@/lib/supabase/database.types';

export type StoredValueActionResult =
  | {
      ok: true;
      purchase: Database['public']['Functions']['get_stored_value_purchase']['Returns'][number];
      payment: {
        accountName: string;
        accountNumber: string;
        bankCode: string;
        qrUrl: string;
      };
    }
  | { ok: false; error: string; reference?: string };

function errorMessage(message: string | undefined, kind: StoredValueKind): string {
  if (message?.includes('DISABLED')) return kind === 'topup' ? 'Chức năng nạp điểm chưa được kích hoạt.' : 'Flash-sale chưa được kích hoạt.';
  if (message?.includes('SOLD_OUT')) return 'Flash-sale đã hết suất.';
  if (message?.includes('USER_LIMIT')) return 'Bạn đã đạt giới hạn của chương trình này.';
  if (message?.includes('UNAVAILABLE')) return 'Chương trình không còn khả dụng.';
  if (message?.includes('NOT_FOUND')) return 'Gói đã chọn không còn tồn tại.';
  if (message?.includes('IDEMPOTENCY_CONFLICT')) return 'Yêu cầu bị trùng khóa. Vui lòng thử lại.';
  return 'Không thể khởi tạo thanh toán lúc này.';
}

export async function createStoredValuePayment(kind: StoredValueKind, input: unknown): Promise<StoredValueActionResult> {
  if (!isStoredValueConfigured()) return { ok: false, error: 'STORED_VALUE_DISABLED' };
  const parsed = parseStoredValueIntentInput(input);
  if (!parsed.ok) return parsed;
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'AUTH_REQUIRED' };

  const correlationId = await getRequestCorrelationId();
  const admin = createAdminSupabaseClient();
  await admin.rpc('expire_pending_stored_value_payments', { p_limit: 100 });
  const supabase = await createServerSupabaseClient();
  const intentResult = kind === 'topup'
    ? await supabase.rpc('create_topup_intent', { p_package_id: parsed.data.itemId, p_idempotency_key: parsed.data.idempotencyKey })
    : await supabase.rpc('create_flash_sale_intent', { p_campaign_id: parsed.data.itemId, p_idempotency_key: parsed.data.idempotencyKey });
  const intent = intentResult.data?.[0];
  if (intentResult.error || !intent) {
    return { ok: false, error: errorMessage(intentResult.error?.message, kind) };
  }

  try {
    const config = getSepayConfig();
    const { data: paymentData, error: paymentError } = await admin.rpc('create_stored_value_payment', {
      p_purchase_type: kind,
      p_purchase_id: intent.purchase_id,
      p_bank_code: config.bankCode,
      p_account_number: config.accountNumber,
    });
    const payment = paymentData?.[0];
    if (paymentError || !payment) throw new Error('PAYMENT_CREATION_FAILED');

    const purchase = {
      purchase_type: kind,
      purchase_id: intent.purchase_id,
      amount_vnd: payment.amount_vnd,
      points: intent.points,
      purchase_status: intent.purchase_status,
      payment_status: payment.payment_status,
      payment_code: payment.payment_code,
      expires_at: payment.expires_at,
      paid_at: null,
    } as Database['public']['Functions']['get_stored_value_purchase']['Returns'][number];

    return {
      ok: true,
      purchase,
      payment: {
        accountName: config.accountName,
        accountNumber: config.accountNumber,
        bankCode: config.bankCode,
        qrUrl: buildSepayQrUrl({
          accountName: config.accountName,
          accountNumber: config.accountNumber,
          amountVnd: payment.amount_vnd,
          bankCode: config.bankCode,
          paymentCode: payment.payment_code,
        }),
      },
    };
  } catch {
    logOperationalFailure({
      correlationId,
      event: 'payment_failed',
      operation: 'create_payment',
      reason: 'configuration_error',
    });
    return { ok: false, error: 'PAYMENT_CREATION_FAILED', reference: correlationId };
  }
}

export async function getStoredValuePaymentStatus(purchaseId: string) {
  if (!isStoredValueConfigured() || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return null;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = createAdminSupabaseClient();
  await admin.rpc('expire_pending_stored_value_payments', { p_limit: 100 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_stored_value_purchase', { p_purchase_id: purchaseId });
  return error || !data?.[0] ? null : data[0];
}
