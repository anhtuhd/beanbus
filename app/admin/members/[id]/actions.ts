'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { logOperationalFailure } from '@/lib/observability/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type MemberPointsAdjustmentState = { status: 'idle' | 'success' | 'error'; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function adjustMemberPoints(
  _previousState: MemberPointsAdjustmentState,
  formData: FormData,
): Promise<MemberPointsAdjustmentState> {
  await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const direction = String(formData.get('direction') ?? '');
  const amount = Number(String(formData.get('amount') ?? ''));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(userId) || !['add', 'subtract'].includes(direction) || !Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
    return { status: 'error', message: 'Số điểm điều chỉnh không hợp lệ.' };
  }
  if (reason.length < 10 || reason.length > 300) {
    return { status: 'error', message: 'Lý do phải dài từ 10 đến 300 ký tự.' };
  }

  const delta = direction === 'subtract' ? -amount : amount;
  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('admin_adjust_member_points', {
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error?.message.includes('INSUFFICIENT_POINTS')) return { status: 'error', message: 'Không thể trừ vượt quá số dư khả dụng.' };
  if (error || !data?.[0]) {
    logOperationalFailure({ correlationId, event: 'admin_operation_failed', operation: 'admin_adjust_member_points', reason: error ? 'database_error' : 'missing_result' });
    return { status: 'error', message: `Không thể điều chỉnh điểm. Mã hỗ trợ: ${correlationId}` };
  }

  revalidatePath(`/admin/members/${userId}`);
  revalidatePath('/admin/members');
  return { status: 'success', message: `Đã ${delta > 0 ? 'cộng' : 'trừ'} ${Math.abs(delta).toLocaleString('vi-VN')} điểm.` };
}
