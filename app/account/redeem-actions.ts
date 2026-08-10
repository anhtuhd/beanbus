'use server';

import { requireProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { RedeemState } from './redeem-state';

export async function redeemMemberReward(_previousState: RedeemState, formData: FormData): Promise<RedeemState> {
  await requireProfile('/account');
  const rewardId = String(formData.get('rewardId') ?? '');
  const idempotencyKey = String(formData.get('idempotencyKey') ?? '');
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(rewardId) || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { status: 'error', message: 'Yêu cầu đổi thưởng không hợp lệ.' };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
    p_reward_id: rewardId,
    p_idempotency_key: idempotencyKey,
  });
  if (error || !data?.[0]) {
    const message = error?.message.includes('INSUFFICIENT_POINTS')
      ? 'Bạn chưa đủ điểm cho phần thưởng này.'
      : error?.message.includes('LOYALTY_DISABLED')
        ? 'Chương trình đổi điểm chưa được kích hoạt.'
        : 'Không thể đổi phần thưởng lúc này.';
    return { status: 'error', message };
  }
  return { status: 'success', voucherCode: data[0].voucher_code, message: `Đổi thành công. Mã voucher của bạn: ${data[0].voucher_code}` };
}
