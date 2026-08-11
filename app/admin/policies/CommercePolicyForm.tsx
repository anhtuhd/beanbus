'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateAdminCommercePolicy } from './actions';
import { initialCommercePolicyState } from './policy-state';
import styles from '../requests/requests.module.css';

type Props = {
  refundEnabled: boolean;
  refundWindowHours: number;
  voucherOnCancel: 'release' | 'consume';
  voucherOnRefund: 'release' | 'consume';
  loyaltyReverseOnCancel: boolean;
  loyaltyReverseOnRefund: boolean;
};

export default function CommercePolicyForm({
  refundEnabled,
  refundWindowHours,
  voucherOnCancel,
  voucherOnRefund,
  loyaltyReverseOnCancel,
  loyaltyReverseOnRefund,
}: Props) {
  const [state, formAction, pending] = useActionState(updateAdminCommercePolicy, initialCommercePolicyState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <div className={styles.editorGrid}>
        <label>
          Thời hạn hoàn tiền (giờ)
          <input name="refundWindowHours" type="number" min="1" max="720" step="1" defaultValue={refundWindowHours} required />
        </label>
        <label>
          Hủy đơn: voucher
          <select name="voucherOnCancel" defaultValue={voucherOnCancel}>
            <option value="release">Trả lại lượt dùng</option>
            <option value="consume">Giữ lượt đã dùng</option>
          </select>
        </label>
        <label>
          Hoàn tiền: voucher
          <select name="voucherOnRefund" defaultValue={voucherOnRefund}>
            <option value="release">Trả lại lượt dùng</option>
            <option value="consume">Giữ lượt đã dùng</option>
          </select>
        </label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="refundEnabled" defaultChecked={refundEnabled} /> Cho phép admin hoàn tiền SePay</label>
        <label><input type="checkbox" name="loyaltyReverseOnCancel" defaultChecked={loyaltyReverseOnCancel} /> Đảo điểm khi hủy đơn</label>
        <label><input type="checkbox" name="loyaltyReverseOnRefund" defaultChecked={loyaltyReverseOnRefund} /> Đảo điểm khi hoàn tiền</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>
          {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
          <span>{pending ? 'Đang lưu' : 'Lưu chính sách'}</span>
        </button>
      </div>
      <p className={styles.helperText}>Voucher và điểm chỉ thay đổi một lần theo trạng thái đơn; mọi lần cập nhật policy được ghi audit.</p>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
