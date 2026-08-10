'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminReward } from './actions';
import { initialRewardAdminState } from './reward-state';
import styles from '../requests/requests.module.css';

type Reward = Pick<Database['public']['Tables']['loyalty_rewards']['Row'], 'id' | 'name_vi' | 'name_en' | 'points_cost' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd' | 'is_active'>;

export default function RewardEditorForm({ reward }: { reward?: Reward }) {
  const [state, formAction, pending] = useActionState(upsertAdminReward, initialRewardAdminState);
  return <form action={formAction} className={styles.productEditor}>
    <div className={styles.editorGrid}>
      <label>ID reward<input name="rewardId" defaultValue={reward?.id ?? ''} disabled={Boolean(reward)} pattern="[a-z0-9][a-z0-9-]*" required /></label>
      <label>Tên VI<input name="nameVi" defaultValue={reward?.name_vi ?? ''} maxLength={180} required /></label>
      <label>Tên EN<input name="nameEn" defaultValue={reward?.name_en ?? ''} maxLength={180} required /></label>
      <label>Chi phí điểm<input name="pointsCost" type="number" min="1" step="1" defaultValue={reward?.points_cost ?? ''} required /></label>
      <label>Loại giảm<select name="discountType" defaultValue={reward?.discount_type ?? 'fixed'}><option value="fixed">Số tiền</option><option value="percent">Phần trăm</option></select></label>
      <label>Giá trị giảm<input name="discountValue" type="number" min="1" step="1" defaultValue={reward?.discount_value ?? ''} required /></label>
      <label>Đơn tối thiểu<input name="minimumSubtotalVnd" type="number" min="0" step="1000" defaultValue={reward?.minimum_subtotal_vnd ?? 0} required /></label>
      <label>Giảm tối đa<input name="maximumDiscountVnd" type="number" min="1" step="1000" defaultValue={reward?.maximum_discount_vnd ?? ''} /></label>
    </div>
    <div className={styles.editorChecks}><label><input type="checkbox" name="isActive" defaultChecked={reward?.is_active ?? false} /> Hiển thị cho hội viên</label><button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span>{pending ? 'Đang lưu' : 'Lưu reward'}</span></button></div>
    {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
  </form>;
}
