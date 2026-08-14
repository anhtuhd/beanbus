'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle, Minus, Plus } from 'lucide-react';
import { adjustMemberPoints, type MemberPointsAdjustmentState } from './actions';
import styles from '../../requests/requests.module.css';

const initialState: MemberPointsAdjustmentState = { status: 'idle', message: '' };

export default function MemberPointsAdjustmentForm({ userId, balancePoints }: { userId: string; balancePoints: number }) {
  const [state, formAction, pending] = useActionState(adjustMemberPoints, initialState);
  return (
    <form action={formAction} className={styles.productEditor} onSubmit={(event) => {
      if (!window.confirm('Xác nhận ghi bút toán điều chỉnh điểm cho hội viên này?')) event.preventDefault();
    }}>
      <input type="hidden" name="userId" value={userId} />
      <div className={styles.editorGrid}>
        <label>Điểm điều chỉnh<input name="amount" type="number" min="1" max="10000000" step="1" required /></label>
        <label>Lý do<input name="reason" minLength={10} maxLength={300} placeholder="Ví dụ: Bù điểm do chương trình tại quầy" required /></label>
      </div>
      <div className={styles.editorChecks}>
        <button type="submit" name="direction" value="add" className={styles.saveButton} disabled={pending}><Plus size={16} /><span>Cộng điểm</span></button>
        <button type="submit" name="direction" value="subtract" className={styles.secondaryButton} disabled={pending}><Minus size={16} /><span>Trừ điểm</span></button>
        {pending && <LoaderCircle size={16} className={styles.spinner} aria-label="Đang lưu" />}
      </div>
      <p className={styles.helperText}>Số dư hiện tại: {balancePoints.toLocaleString('vi-VN')} điểm. Mọi thay đổi tạo ledger audit, không sửa số dư trực tiếp.</p>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</span>}
      {!pending && state.status === 'success' && <Check size={16} aria-hidden="true" />}
    </form>
  );
}
