'use client';

import { useActionState } from 'react';
import { LoaderCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { cancelMemberBooking } from '../booking-actions';
import { cancelMemberCustomerRequest } from '../customer-request-actions';
import { initialMemberBookingCancelState } from '../booking-state';
import styles from '../account.module.css';

export default function CancelBookingForm({ requestId, currentStatus, kind = 'booking' }: { requestId: string; currentStatus: string; kind?: 'booking' | 'customer' }) {
  const { t } = useLanguage();
  const action = kind === 'booking' ? cancelMemberBooking : cancelMemberCustomerRequest;
  const [state, formAction, pending] = useActionState(action, initialMemberBookingCancelState);
  const cancellableStatuses = kind === 'booking' ? ['pending', 'confirmed'] : ['pending', 'in_progress'];

  if (!cancellableStatuses.includes(currentStatus)) return null;

  return (
    <div className={styles.requestActions}>
      <form action={formAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
          {pending ? <LoaderCircle size={14} className={styles.spinner} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
          <span>{pending ? t('Đang hủy...', 'Cancelling...') : kind === 'booking' ? t('Hủy đặt bàn', 'Cancel booking') : t('Hủy yêu cầu', 'Withdraw request')}</span>
        </button>
      </form>
      {state.status !== 'idle' && (
        <p className={state.status === 'error' ? styles.accountStatus : styles.formSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </p>
      )}
    </div>
  );
}
