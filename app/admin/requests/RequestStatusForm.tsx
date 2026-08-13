'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import {
  updateBookingRequestStatus,
  updateCustomerRequestStatus,
} from './actions';
import styles from './requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Props = {
  currentStatus: string;
  kind: 'booking' | 'customer';
  requestId: string;
};

const NEXT_BOOKING_STATUS: Record<string, string[]> = {
  pending: ['pending', 'confirmed', 'rejected', 'cancelled'],
  confirmed: ['confirmed', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  rejected: ['rejected'],
};

const NEXT_CUSTOMER_STATUS: Record<string, string[]> = {
  pending: ['pending', 'in_progress', 'rejected'],
  in_progress: ['in_progress', 'resolved', 'rejected'],
  resolved: ['resolved'],
  rejected: ['rejected'],
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

const initialRequestStatusState = { message: '', status: 'idle' as const };

export default function RequestStatusForm({ currentStatus, kind, requestId }: Props) {
  const action = kind === 'booking' ? updateBookingRequestStatus : updateCustomerRequestStatus;
  const [state, formAction, pending] = useActionState(action, initialRequestStatusState);
  const options = (kind === 'booking' ? NEXT_BOOKING_STATUS : NEXT_CUSTOMER_STATUS)[currentStatus] ?? [currentStatus];
  const terminal = options.length === 1;

  if (terminal) return <span className={`${styles.statusBadge} ${styles[`status_${currentStatus}`]}`}>{STATUS_LABEL[currentStatus] ?? currentStatus}</span>;

  return (
    <form action={formAction} className={styles.statusForm}>
      <input type="hidden" name="requestId" value={requestId} />
      <select name="status" defaultValue={currentStatus} aria-label="Trạng thái mới" disabled={pending}>
        {options.map((status) => <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>)}
      </select>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu trạng thái">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span><LocalizedText vi={pending ? 'Đang lưu' : 'Lưu'} en={pending ? 'Saving...' : 'Save'} /></span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
