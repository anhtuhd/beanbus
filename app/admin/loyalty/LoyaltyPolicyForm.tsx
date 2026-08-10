'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateAdminLoyaltyPolicy } from './actions';
import { initialLoyaltyPolicyState } from './loyalty-state';
import styles from '../requests/requests.module.css';

export default function LoyaltyPolicyForm({ enabled, earnBps, codEligible }: { enabled: boolean; earnBps: number; codEligible: boolean }) {
  const [state, formAction, pending] = useActionState(updateAdminLoyaltyPolicy, initialLoyaltyPolicyState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <div className={styles.editorGrid}>
        <label>Tỷ lệ tích điểm (bps)<input name="earnBps" type="number" min="0" max="10000" step="1" defaultValue={earnBps} required /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="enabled" defaultChecked={enabled} /> Kích hoạt loyalty</label>
        <label><input type="checkbox" name="codEligible" defaultChecked={codEligible} /> COD được tích điểm sau hoàn thành</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span>{pending ? 'Đang lưu' : 'Lưu policy'}</span></button>
      </div>
      <p className={styles.helperText}>1 bps = 0,01% giá trị đơn; ví dụ 100 bps = 1 điểm trên mỗi 100đ đủ điều kiện.</p>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
