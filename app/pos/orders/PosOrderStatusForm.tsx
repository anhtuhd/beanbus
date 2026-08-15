'use client';

import { useState } from 'react';
import { ArrowRight, Check, CircleCheckBig, LoaderCircle } from 'lucide-react';
import { advanceCounterOrder } from './actions';
import styles from '@/app/admin/requests/requests.module.css';
import type { Database } from '@/lib/supabase/database.types';

type OrderStatus = Database['public']['Enums']['order_status'];
const steps: Array<{ status: Exclude<OrderStatus, 'cancelled'>; vi: string; en: string }> = [
  { status: 'pending', vi: 'Chờ xác nhận', en: 'Pending' },
  { status: 'confirmed', vi: 'Đã xác nhận', en: 'Confirmed' },
  { status: 'preparing', vi: 'Đang chuẩn bị', en: 'Preparing' },
  { status: 'ready', vi: 'Sẵn sàng', en: 'Ready' },
  { status: 'completed', vi: 'Hoàn tất', en: 'Completed' },
];

export default function PosOrderStatusForm({ orderId, currentStatus }: { orderId: string; currentStatus: OrderStatus }) {
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentIndex = steps.findIndex((step) => step.status === status);
  const isTerminal = status === 'cancelled' || currentIndex < 0 || status === 'completed';
  const next = isTerminal ? undefined : steps[currentIndex + 1];

  async function advance() {
    if (!next || busy) return;
    setBusy(true);
    setError('');
    const result = await advanceCounterOrder(orderId);
    if (result.ok) setStatus(next.status);
    else setError(result.error);
    setBusy(false);
  }

  return (
    <div className={styles.orderWorkflow}>
      <ol className={styles.orderProgress} aria-label="Tiến trình đơn hàng">
        {steps.map((step, index) => {
          const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
          return <li key={step.status} className={`${styles.orderStep} ${styles[`orderStep_${state}`]}`} aria-current={state === 'current' ? 'step' : undefined}><span className={styles.orderStepIcon}>{state === 'complete' ? <Check size={16} /> : <span>{index + 1}</span>}</span><span>{step.vi}<small>{step.en}</small></span></li>;
        })}
      </ol>
      {next ? <button type="button" className={styles.nextStatusButton} onClick={() => void advance()} disabled={busy}><ArrowRight size={17} /> {busy ? <LoaderCircle className={styles.spinner} /> : `Chuyển sang: ${next.vi}`}</button> : <span className={styles.completedState}><CircleCheckBig size={16} /> {status === 'cancelled' ? 'Đơn đã hủy' : 'Quy trình đã hoàn tất'}</span>}
      {error && <p className={styles.actionError} role="alert">{error}</p>}
    </div>
  );
}
