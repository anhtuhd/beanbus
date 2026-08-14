'use client';

import { useActionState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheckBig,
  CircleX,
  ClipboardList,
  Coffee,
  CreditCard,
  LoaderCircle,
  PackageCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { updateAdminOrderStatus } from './actions';
import styles from '../requests/requests.module.css';
import type { Database } from '@/lib/supabase/database.types';
import { useLanguage } from '@/context/LanguageContext';
import {
  ACTIVE_ORDER_STEPS,
  canCancelOrder,
  getNextOrderStatus,
  type OrderStatus,
} from './order-workflow';

type PaymentMethod = Database['public']['Enums']['order_payment_method'];
type PaymentStatus = Database['public']['Enums']['order_payment_status'];

type Props = {
  currentStatus: OrderStatus;
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

const STATUS_META: Record<Exclude<OrderStatus, 'cancelled'>, { icon: LucideIcon; vi: string; en: string }> = {
  pending: { icon: ClipboardList, vi: 'Đơn mới', en: 'New order' },
  confirmed: { icon: BadgeCheck, vi: 'Đã nhận', en: 'Accepted' },
  preparing: { icon: Coffee, vi: 'Đang chuẩn bị', en: 'Preparing' },
  ready: { icon: PackageCheck, vi: 'Sẵn sàng', en: 'Ready' },
  completed: { icon: CircleCheckBig, vi: 'Hoàn tất', en: 'Completed' },
};

const STATUS_DESCRIPTION: Record<OrderStatus, { vi: string; en: string }> = {
  pending: { vi: 'Đơn mới đang chờ quán xác nhận.', en: 'This new order is waiting for acceptance.' },
  confirmed: { vi: 'Đơn đã được nhận và có thể bắt đầu chuẩn bị.', en: 'The order is accepted and ready to prepare.' },
  preparing: { vi: 'Quầy đang chuẩn bị và đóng gói món.', en: 'The order is being prepared and packed.' },
  ready: { vi: 'Món đã sẵn sàng để giao hoặc nhận tại quán.', en: 'The order is ready for pickup or delivery.' },
  completed: { vi: 'Đơn hàng đã hoàn tất.', en: 'The order has been completed.' },
  cancelled: { vi: 'Đơn hàng đã bị hủy.', en: 'The order has been cancelled.' },
};

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, { vi: string; en: string }>> = {
  confirmed: { vi: 'Xác nhận đơn', en: 'Accept order' },
  preparing: { vi: 'Bắt đầu chuẩn bị', en: 'Start preparing' },
  ready: { vi: 'Đánh dấu sẵn sàng', en: 'Mark as ready' },
  completed: { vi: 'Hoàn tất đơn', en: 'Complete order' },
};

const initialOrderStatusState = { message: '', status: 'idle' as const };

export default function OrderStatusForm({ currentStatus, orderId, paymentMethod, paymentStatus }: Props) {
  const { t } = useLanguage();
  const [state, formAction, pending] = useActionState(updateAdminOrderStatus, initialOrderStatusState);
  const nextStatus = getNextOrderStatus(currentStatus, paymentMethod, paymentStatus);
  const nextLabel = nextStatus ? NEXT_ACTION_LABEL[nextStatus] : null;
  const cancellable = canCancelOrder(currentStatus, paymentStatus);
  const currentStepIndex = ACTIVE_ORDER_STEPS.indexOf(currentStatus);
  const waitingForPayment = currentStatus === 'pending' && paymentMethod === 'sepay_qr' && paymentStatus !== 'paid';
  const settlementFinalized = paymentStatus === 'failed' || paymentStatus === 'refunded';

  const confirmCancellation = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancelled' && !window.confirm(t('Xác nhận hủy đơn hàng này?', 'Cancel this order?'))) {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.orderWorkflow}>
      <ol className={styles.orderProgress} aria-label={t('Tiến trình đơn hàng', 'Order progress')}>
        {ACTIVE_ORDER_STEPS.map((step, index) => {
          const meta = STATUS_META[step as Exclude<OrderStatus, 'cancelled'>];
          const Icon = meta.icon;
          const stepState = currentStatus === 'cancelled'
            ? 'upcoming'
            : index < currentStepIndex
              ? 'complete'
              : index === currentStepIndex
                ? 'current'
                : 'upcoming';
          return (
            <li
              key={step}
              className={`${styles.orderStep} ${styles[`orderStep_${stepState}`]}`}
              aria-current={stepState === 'current' ? 'step' : undefined}
            >
              <span className={styles.orderStepIcon} aria-hidden="true">
                {stepState === 'complete' ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <span>{t(meta.vi, meta.en)}</span>
            </li>
          );
        })}
      </ol>

      {currentStatus === 'cancelled' || settlementFinalized ? (
        <div className={styles.cancelledState} role="status">
          <CircleX size={18} aria-hidden="true" />
          <span>{settlementFinalized
            ? paymentStatus === 'refunded'
              ? t('Đơn hàng đã hoàn tiền và không thể tiếp tục xử lý.', 'This order was refunded and cannot continue through fulfillment.')
              : t('Thanh toán đã thất bại và đơn hàng không thể tiếp tục xử lý.', 'Payment failed and this order cannot continue through fulfillment.')
            : t(STATUS_DESCRIPTION.cancelled.vi, STATUS_DESCRIPTION.cancelled.en)}</span>
        </div>
      ) : (
        <form action={formAction} className={styles.orderStatusForm} onSubmit={confirmCancellation}>
          <input type="hidden" name="orderId" value={orderId} />
          <div className={styles.orderStatusSummary}>
            <strong>{t(STATUS_META[currentStatus].vi, STATUS_META[currentStatus].en)}</strong>
            <span>{t(STATUS_DESCRIPTION[currentStatus].vi, STATUS_DESCRIPTION[currentStatus].en)}</span>
          </div>
          <div className={styles.orderStatusActions}>
            {waitingForPayment ? (
              <span className={styles.paymentWait} role="status">
                <CreditCard size={16} aria-hidden="true" />
                {t('Chờ SePay xác nhận thanh toán', 'Waiting for SePay payment')}
              </span>
            ) : nextStatus && nextLabel ? (
              <button type="submit" name="status" value={nextStatus} className={styles.nextStatusButton} disabled={pending}>
                {pending ? <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                <span>{pending ? t('Đang cập nhật...', 'Updating...') : t(nextLabel.vi, nextLabel.en)}</span>
              </button>
            ) : (
              <span className={styles.completedState}><CircleCheckBig size={16} /> {t('Quy trình đã hoàn tất', 'Workflow completed')}</span>
            )}
            {cancellable && (
              <button type="submit" name="status" value="cancelled" className={styles.cancelOrderButton} disabled={pending}>
                <X size={15} aria-hidden="true" /> {t('Hủy đơn', 'Cancel order')}
              </button>
            )}
          </div>
          {state.status !== 'idle' && (
            <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
              {state.message}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
