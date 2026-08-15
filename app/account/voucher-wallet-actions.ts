'use server';

import { requireProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function claimMemberVoucher(code: string): Promise<{ ok: true; claimed: boolean } | { ok: false; error: string }> {
  const profile = await requireProfile('/account?tab=vouchers');
  if (profile.role !== 'member') return { ok: false, error: 'Chỉ hội viên mới có thể lấy voucher.' };
  const value = code.trim().toUpperCase().slice(0, 64);
  if (!value) return { ok: false, error: 'Nhập mã voucher trước khi lấy.' };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('claim_voucher', { p_voucher_code: value });
  if (error) return { ok: false, error: error.message.includes('INVALID_VOUCHER') ? 'Voucher không hợp lệ, đã hết hạn hoặc hết lượt.' : error.message.includes('VOUCHER_ALREADY_USED') ? 'Voucher này đã được sử dụng.' : 'Không thể lấy voucher lúc này.' };
  return { ok: true, claimed: data?.[0]?.claimed === true };
}
