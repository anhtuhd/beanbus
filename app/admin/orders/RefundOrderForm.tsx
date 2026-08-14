'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle, RotateCcw } from 'lucide-react';
import { refundAdminOrder } from './refund-actions';
import { initialRefundOrderState } from './refund-state';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function RefundOrderForm({ orderId, amountVnd }: { orderId: string; amountVnd: number }) {
  const [state, formAction, pending] = useActionState(refundAdminOrder, initialRefundOrderState);
  return (
    <form
      action={formAction}
      className={styles.productStatusForm}
      onSubmit={(event) => {
        if (!window.confirm(`Xác nhận hoàn ${amountVnd.toLocaleString('vi-VN')}đ cho đơn này?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" className={styles.archiveButton} disabled={pending} title="Hoàn tiền đơn hàng">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <RotateCcw size={16} />}
        <span><LocalizedText vi={pending ? 'Đang xử lý' : 'Hoàn tiền đơn hàng'} en={pending ? 'Processing' : 'Refund order'} /></span>
      </button>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.status === 'success' ? <Check size={14} /> : null}{state.message}</span>}
    </form>
  );
}
