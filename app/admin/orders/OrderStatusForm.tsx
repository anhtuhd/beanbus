'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateAdminOrderStatus } from './actions';
import styles from '../requests/requests.module.css';
import type { Database } from '@/lib/supabase/database.types';

type OrderStatus = Database['public']['Enums']['order_status'];
type PaymentMethod = Database['public']['Enums']['order_payment_method'];
type PaymentStatus = Database['public']['Enums']['order_payment_status'];

type Props = {
  currentStatus: OrderStatus;
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['pending', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'preparing', 'cancelled'],
  preparing: ['preparing', 'ready', 'cancelled'],
  ready: ['ready', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

const initialOrderStatusState = { message: '', status: 'idle' as const };

export default function OrderStatusForm({ currentStatus, orderId, paymentMethod, paymentStatus }: Props) {
  const [state, formAction, pending] = useActionState(updateAdminOrderStatus, initialOrderStatusState);
  let options = NEXT_STATUS[currentStatus];
  if (currentStatus === 'pending' && paymentMethod === 'sepay_qr' && paymentStatus !== 'paid') {
    options = options.filter((status) => status !== 'confirmed');
  }
  if (paymentStatus === 'paid') options = options.filter((status) => status !== 'cancelled');
  const terminal = options.length === 1;

  if (terminal) return <span className={`${styles.statusBadge} ${styles[`status_${currentStatus}`]}`}>{STATUS_LABEL[currentStatus]}</span>;

  return (
    <form action={formAction} className={styles.statusForm}>
      <input type="hidden" name="orderId" value={orderId} />
      <select name="status" defaultValue={currentStatus} aria-label="Trạng thái đơn mới" disabled={pending}>
        {options.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
      </select>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu trạng thái đơn">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span>{pending ? 'Đang lưu' : 'Lưu'}</span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
