'use server';

import { revalidatePath } from 'next/cache';
import { getSiteUrl } from '@/lib/env';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { requireAdmin, requireOperator } from '@/lib/auth/session';
import { parseCreateOrderInput } from '@/lib/orders/input';
import { getSepayConfig } from '@/lib/payments/sepay-config';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type AdminOrderMember = {
  id: string;
  memberNumber: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  pendingPhone?: string | null;
  membershipStatus?: string;
  availablePoints: number;
};

export type AdminOrderResult =
  | {
      ok: true;
      order: {
        cashDueVnd: number;
        id: string;
        number: number;
        receipt: string;
        status: string;
        totalVnd: number;
      };
      guestReceiptUrl?: string;
    }
  | { ok: false; error: string; reference?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function enabled(): boolean {
  return process.env.ENABLE_ADMIN_ASSISTED_ORDERS === 'true';
}

function errorMessage(message: string | undefined): string {
  if (!message) return '';
  return message.toUpperCase();
}

function mapDatabaseError(message: string | undefined): string {
  const code = errorMessage(message);
  if (code.includes('TARGET_MEMBER_REQUIRED')) return 'Hội viên không hợp lệ hoặc đã bị thay đổi quyền.';
  if (code.includes('MEMBER_BLOCKED')) return 'Hội viên đang bị khóa quyền sử dụng.';
  if (code.includes('VOUCHER_CONSENT_REQUIRED')) return 'Cần xác nhận hội viên đồng ý và nhập lý do lấy voucher từ 10 đến 300 ký tự.';
  if (code.includes('POINTS_CONSENT_REQUIRED')) return 'Cần xác nhận đồng ý và nhập lý do dùng điểm từ 10 đến 300 ký tự.';
  if (code.includes('INVALID_POINTS_CONSENT')) return 'Thông tin xác nhận dùng điểm không hợp lệ.';
  if (code.includes('POINTS_PAYMENT_DISABLED')) return 'Thanh toán bằng điểm đang tắt trong chính sách loyalty.';
  if (code.includes('INSUFFICIENT_POINTS')) return 'Hội viên không đủ điểm khả dụng.';
  if (code.includes('POINTS_EXCEED_ORDER_TOTAL')) return 'Số điểm dùng không được vượt quá tổng đơn.';
  if (code.includes('VOUCHER_NOT_OWNED')) return 'Voucher này không thuộc hội viên đã chọn.';
  if (code.includes('INVALID_VOUCHER')) return 'Voucher không hợp lệ hoặc đã hết hiệu lực.';
  if (code.includes('PRODUCT_UNAVAILABLE')) return 'Một món không còn bán hoặc đã hết giờ phục vụ.';
  if (code.includes('INVALID_OPTION')) return 'Tuỳ chọn món không còn hợp lệ.';
  if (code.includes('INVALID_OPTION_SELECTIONS') || code.includes('CONFLICTING_OPTION')) return 'Vui lòng kiểm tra lại tuỳ chọn món.';
  if (code.includes('IDEMPOTENCY_CONFLICT')) return 'Mã thao tác đã được dùng cho dữ liệu khác. Vui lòng thử lại.';
  if (code.includes('INVALID_CUSTOMER')) return 'Tên hoặc số điện thoại khách hàng không hợp lệ.';
  if (code.includes('INVALID_PICKUP') || code.includes('INVALID_DELIVERY')) return 'Thông tin nhận hàng không hợp lệ.';
  return 'Không thể tạo đơn hàng lúc này.';
}

export async function searchAdminOrderMembers(query: string): Promise<AdminOrderMember[]> {
  await requireAdmin();
  if (!enabled()) return [];
  const search = query.trim().slice(0, 80);
  if (search.length < 2) return [];

  const supabase = await createServerSupabaseClient();
  const phone = normalizeVietnameseMobile(search);
  const profiles = new Map<string, { id: string; member_number: number; full_name: string | null; email: string | null; phone: string | null }>();
  if (phone) {
    const result = await supabase.from('profiles').select('id, member_number, full_name, email, phone').eq('role', 'member').eq('phone', phone).limit(10);
    for (const profile of result.data ?? []) profiles.set(profile.id, profile);
  }
  if (search.includes('@')) {
    const result = await supabase.from('profiles').select('id, member_number, full_name, email, phone').eq('role', 'member').eq('email', search.toLowerCase()).limit(10);
    for (const profile of result.data ?? []) profiles.set(profile.id, profile);
  }
  if (/^\d{1,12}$/.test(search)) {
    const result = await supabase.from('profiles').select('id, member_number, full_name, email, phone').eq('role', 'member').eq('member_number', Number(search)).limit(10);
    for (const profile of result.data ?? []) profiles.set(profile.id, profile);
  }
  const nameResult = await supabase.from('profiles').select('id, member_number, full_name, email, phone').eq('role', 'member').ilike('full_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`).limit(10);
  for (const profile of nameResult.data ?? []) {
    profiles.set(profile.id, profile);
  }
  const rows = [...profiles.values()].slice(0, 10);
  if (rows.length === 0) return [];
  const balances = await supabase.rpc('get_admin_member_point_balances', { p_user_ids: rows.map((row) => row.id) });
  const balanceMap = new Map((balances.data ?? []).map((row) => [row.user_id, Math.max(0, Number(row.available_points ?? 0))]));
  return rows.map((row) => ({
    id: row.id,
    memberNumber: row.member_number,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    availablePoints: balanceMap.get(row.id) ?? 0,
  }));
}

export async function searchPosMembers(query: string): Promise<AdminOrderMember[]> {
  await requireOperator();
  if (process.env.ENABLE_POS_STAFF !== 'true') return [];
  const search = query.trim().slice(0, 80);
  if (search.length < 2) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('operator_search_members', { p_query: search, p_limit: 10 });
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    memberNumber: row.member_number,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    pendingPhone: row.pending_phone,
    membershipStatus: row.membership_status,
    availablePoints: Math.max(0, Number(row.available_points ?? 0)),
  }));
}

export async function claimCounterVoucher(
  memberId: string,
  code: string,
  consentNote: string,
): Promise<{ ok: true; claimed: boolean } | { ok: false; error: string }> {
  await requireOperator();
  if (process.env.ENABLE_POS_STAFF !== 'true') return { ok: false, error: 'POS đang tạm tắt.' };
  const value = code.trim().toUpperCase().slice(0, 64);
  const note = consentNote.trim();
  if (!UUID.test(memberId) || !value) return { ok: false, error: 'Hội viên hoặc mã voucher không hợp lệ.' };
  if (note.length < 10 || note.length > 300) return { ok: false, error: 'Lý do lấy voucher phải từ 10 đến 300 ký tự.' };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('operator_claim_member_voucher', {
    p_member_id: memberId,
    p_voucher_code: value,
    p_consent_confirmed: true,
    p_consent_note: note,
  });
  if (error) return { ok: false, error: mapDatabaseError(error.message) };
  return { ok: true, claimed: data?.[0]?.claimed === true };
}

export async function createPendingMember(input: { phone: string; fullName: string }): Promise<
  | { ok: true; member: AdminOrderMember }
  | { ok: false; error: string }
> {
  await requireOperator();
  if (process.env.ENABLE_POS_STAFF !== 'true') return { ok: false, error: 'POS đang tạm tắt.' };
  const phone = normalizeVietnameseMobile(input.phone);
  const fullName = input.fullName.trim();
  if (!phone || fullName.length < 2 || fullName.length > 100) return { ok: false, error: 'Tên hoặc số điện thoại không hợp lệ.' };

  const admin = createAdminSupabaseClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: false,
    user_metadata: { full_name: fullName, pending_phone: phone },
  });
  if (createError || !created.user) return { ok: false, error: 'Số điện thoại đã có tài khoản hoặc không thể tạo hội viên.' };

  const supabase = await createServerSupabaseClient();
  const { data: registered, error: registerError } = await supabase.rpc('operator_register_pending_member', {
    p_user_id: created.user.id,
    p_pending_phone: phone,
    p_full_name: fullName,
  });
  if (registerError || !registered?.[0]) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: registerError?.message.includes('MEMBER_PHONE_EXISTS') ? 'Số điện thoại đã có hội viên.' : 'Không thể hoàn tất hồ sơ hội viên.' };
  }

  return {
    ok: true,
    member: {
      id: created.user.id,
      memberNumber: registered[0].member_number,
      fullName,
      email: null,
      phone: null,
      pendingPhone: phone,
      membershipStatus: 'pending',
      availablePoints: 0,
    },
  };
}

export async function createAdminAssistedOrder(input: unknown): Promise<AdminOrderResult> {
  return createAssistedOrder(input, false);
}

export async function createCounterOrder(input: unknown): Promise<AdminOrderResult> {
  return createAssistedOrder(input, true);
}

async function createAssistedOrder(input: unknown, operatorMode: boolean): Promise<AdminOrderResult> {
  if (operatorMode) await requireOperator();
  else await requireAdmin();
  if ((!operatorMode && !enabled()) || (operatorMode && process.env.ENABLE_POS_STAFF !== 'true')) return { ok: false, error: operatorMode ? 'POS đang tạm tắt.' : 'Tính năng tạo đơn hộ đang tạm tắt.' };
  if (!input || typeof input !== 'object') return { ok: false, error: 'Dữ liệu tạo đơn không hợp lệ.' };
  const raw = input as Record<string, unknown>;
  const targetMemberId = raw.targetMemberId === null || raw.targetMemberId === undefined || raw.targetMemberId === '' ? null : String(raw.targetMemberId);
  if (targetMemberId && !UUID.test(targetMemberId)) return { ok: false, error: 'Hội viên không hợp lệ.' };
  const pointsConsentConfirmed = raw.pointsConsentConfirmed === true;
  const pointsConsentNote = typeof raw.pointsConsentNote === 'string' ? raw.pointsConsentNote.trim() : '';
  const voucherConsentConfirmed = raw.voucherConsentConfirmed === true;
  const voucherConsentNote = typeof raw.voucherConsentNote === 'string' ? raw.voucherConsentNote.trim() : '';
  const parsed = parseCreateOrderInput(raw);
  if (!parsed.ok) return parsed;
  if (parsed.data.pointsToApply > 0 && !targetMemberId) return { ok: false, error: 'Khách vãng lai không thể dùng điểm.' };
  if (parsed.data.pointsToApply > 0 && (!pointsConsentConfirmed || pointsConsentNote.length < 10 || pointsConsentNote.length > 300)) {
    return { ok: false, error: 'Cần xác nhận đồng ý và nhập lý do dùng điểm từ 10 đến 300 ký tự.' };
  }
  if (operatorMode && targetMemberId && parsed.data.voucherCode && (!voucherConsentConfirmed || voucherConsentNote.length < 10 || voucherConsentNote.length > 300)) {
    return { ok: false, error: 'Cần xác nhận hội viên đồng ý và nhập lý do sử dụng voucher từ 10 đến 300 ký tự.' };
  }
  if (parsed.data.paymentMethod === 'sepay_qr' && process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true') {
    return { ok: false, error: 'Thanh toán QR hiện chưa được bật.' };
  }
  if (parsed.data.pointsToApply > 0 && process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT !== 'true') {
    return { ok: false, error: 'Thanh toán bằng điểm hiện chưa được bật.' };
  }

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  let data;
  let error;
  try {
    const sharedArgs = {
      p_idempotency_key: parsed.data.idempotencyKey,
      p_target_member_id: targetMemberId,
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
      p_points_consent_confirmed: pointsConsentConfirmed,
      p_points_consent_note: parsed.data.pointsToApply > 0 ? pointsConsentNote : null,
    };
    if (operatorMode) {
      ({ data, error } = await supabase.rpc('operator_create_counter_order', {
        ...sharedArgs,
        p_voucher_consent_confirmed: voucherConsentConfirmed,
        p_voucher_consent_note: parsed.data.voucherCode ? voucherConsentNote : null,
      }));
    } else {
      ({ data, error } = await supabase.rpc('admin_create_server_priced_order', sharedArgs));
    }
  } catch {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'create_order', reason: 'database_error' });
    return { ok: false, error: 'Không thể tạo đơn hàng.', reference: correlationId };
  }
  const order = data?.[0];
  if (error || !order) {
    if (error) return { ok: false, error: mapDatabaseError(error.message), reference: correlationId };
    return { ok: false, error: 'Không thể tạo đơn hàng.', reference: correlationId };
  }

  if (!order.receipt_token) {
    await createAdminSupabaseClient().rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
    return { ok: false, error: 'Không thể tạo biên nhận.', reference: correlationId };
  }

  if (parsed.data.paymentMethod === 'sepay_qr' && order.cash_due_vnd > 0) {
    let config;
    try {
      config = getSepayConfig();
    } catch {
      await createAdminSupabaseClient().rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
      return { ok: false, error: 'Cấu hình thanh toán QR chưa hoàn tất.', reference: correlationId };
    }
    const admin = createAdminSupabaseClient();
    let paymentError = false;
    try {
      const payment = await admin.rpc('create_sepay_payment', {
        p_order_id: order.order_id,
        p_receipt_token: order.receipt_token,
        p_bank_code: config.bankCode,
        p_account_number: config.accountNumber,
      });
      paymentError = Boolean(payment.error || !payment.data?.[0] || payment.data[0].amount_vnd !== order.cash_due_vnd);
    } catch {
      paymentError = true;
    }
    if (paymentError) {
      const existing = await admin.from('payments').select('status, amount_vnd').eq('order_id', order.order_id).maybeSingle();
      const paymentExists = !existing.error && existing.data?.amount_vnd === order.cash_due_vnd && ['pending', 'paid'].includes(existing.data.status);
      if (!paymentExists) {
        await admin.rpc('compensate_order_payment_failure', { p_order_id: order.order_id });
        return { ok: false, error: 'Không thể tạo mã thanh toán QR.', reference: correlationId };
      }
    }
  }

  revalidatePath('/admin/orders');
  revalidatePath('/pos');
  revalidatePath(`/admin/orders/${order.order_id}`);
  if (targetMemberId) revalidatePath(`/admin/members/${targetMemberId}`);
  return {
    ok: true,
    order: {
      id: order.order_id,
      number: order.order_number,
      receipt: order.receipt_token,
      totalVnd: order.total_vnd,
      cashDueVnd: order.cash_due_vnd,
      status: order.status,
    },
    guestReceiptUrl: targetMemberId ? undefined : `${getSiteUrl()}/order/confirmation/${order.order_id}?receipt=${encodeURIComponent(order.receipt_token)}`,
  };
}
