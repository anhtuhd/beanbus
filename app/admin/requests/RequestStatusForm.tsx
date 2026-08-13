'use client';

import { useActionState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  CircleCheckBig,
  CircleX,
  ClipboardList,
  Inbox,
  LoaderCircle,
  MessageCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedText } from '@/components/ui/LocalizedText';
import { useLanguage } from '@/context/LanguageContext';
import {
  getRequestWorkflow,
  REQUEST_STATUS_LABELS,
  REQUEST_WORKFLOW_STEPS,
  type RequestKind,
  type RequestStatus,
} from './request-workflow';
import {
  updateBookingRequestStatus,
  updateCustomerRequestStatus,
} from './actions';
import styles from './requests.module.css';

type Props = {
  currentStatus: string;
  kind: RequestKind;
  requestId: string;
  variant?: 'compact' | 'detail';
};

const STEP_META: Record<RequestKind, Record<string, { icon: LucideIcon; vi: string; en: string }>> = {
  booking: {
    pending: { icon: ClipboardList, vi: 'Chờ xác nhận', en: 'Awaiting confirmation' },
    confirmed: { icon: BadgeCheck, vi: 'Đã xác nhận', en: 'Confirmed' },
    completed: { icon: CalendarCheck2, vi: 'Hoàn tất', en: 'Completed' },
  },
  customer: {
    pending: { icon: Inbox, vi: 'Chờ xử lý', en: 'Pending' },
    in_progress: { icon: MessageCircle, vi: 'Đang xử lý', en: 'In progress' },
    resolved: { icon: CircleCheckBig, vi: 'Đã giải quyết', en: 'Resolved' },
  },
};

const STATUS_DESCRIPTION: Record<RequestKind, Record<string, { vi: string; en: string }>> = {
  booking: {
    pending: { vi: 'Đặt bàn mới đang chờ quán xác nhận.', en: 'This booking is waiting for confirmation.' },
    confirmed: { vi: 'Đặt bàn đã được xác nhận.', en: 'This booking has been confirmed.' },
    completed: { vi: 'Đặt bàn đã hoàn tất.', en: 'This booking is complete.' },
    cancelled: { vi: 'Yêu cầu đặt bàn đã bị hủy.', en: 'This booking was cancelled.' },
    rejected: { vi: 'Yêu cầu đặt bàn đã bị từ chối.', en: 'This booking was rejected.' },
  },
  customer: {
    pending: { vi: 'Yêu cầu mới đang chờ nhân viên tiếp nhận.', en: 'This request is waiting to be picked up.' },
    in_progress: { vi: 'Yêu cầu đang được xử lý.', en: 'This request is being handled.' },
    resolved: { vi: 'Yêu cầu đã được giải quyết.', en: 'This request has been resolved.' },
    cancelled: { vi: 'Yêu cầu đã bị hủy.', en: 'This request was cancelled.' },
    rejected: { vi: 'Yêu cầu đã bị từ chối.', en: 'This request was rejected.' },
  },
};

const ACTION_LABELS: Record<RequestKind, Record<string, { vi: string; en: string }>> = {
  booking: {
    confirmed: { vi: 'Xác nhận đặt bàn', en: 'Confirm booking' },
    completed: { vi: 'Hoàn tất đặt bàn', en: 'Complete booking' },
    rejected: { vi: 'Từ chối', en: 'Reject' },
    cancelled: { vi: 'Hủy đặt bàn', en: 'Cancel booking' },
  },
  customer: {
    in_progress: { vi: 'Bắt đầu xử lý', en: 'Start handling' },
    resolved: { vi: 'Đánh dấu đã giải quyết', en: 'Mark as resolved' },
    rejected: { vi: 'Từ chối', en: 'Reject' },
    cancelled: { vi: 'Hủy yêu cầu', en: 'Cancel request' },
  },
};

const initialRequestStatusState = { message: '', status: 'idle' as const };

function statusLabel(status: string, lang: 'vi' | 'en'): string {
  const label = REQUEST_STATUS_LABELS[status as RequestStatus];
  return label?.[lang] ?? status;
}

export default function RequestStatusForm({ currentStatus, kind, requestId, variant = 'compact' }: Props) {
  const { lang, t } = useLanguage();
  const action = kind === 'booking' ? updateBookingRequestStatus : updateCustomerRequestStatus;
  const [state, formAction, pending] = useActionState(action, initialRequestStatusState);
  const workflow = getRequestWorkflow(kind, currentStatus);
  const steps = REQUEST_WORKFLOW_STEPS[kind];
  const terminal = workflow.terminal;
  const description = STATUS_DESCRIPTION[kind][currentStatus] ?? {
    vi: 'Trạng thái yêu cầu đã được cập nhật.',
    en: 'This request status has been updated.',
  };

  const confirmExceptionalAction = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!submitter || !['rejected', 'cancelled'].includes(submitter.value)) return;
    const label = ACTION_LABELS[kind][submitter.value];
    if (!window.confirm(t(`Xác nhận ${label?.vi.toLowerCase() ?? 'cập nhật'}?`, `Confirm ${label?.en.toLowerCase() ?? 'this update'}?`))) {
      event.preventDefault();
    }
  };

  return (
    <div className={`${styles.requestWorkflow} ${variant === 'detail' ? styles.requestWorkflowDetail : ''}`}>
      <ol className={styles.orderProgress} aria-label={t('Tiến trình yêu cầu', 'Request progress')}>
        {steps.map((step, index) => {
          const meta = STEP_META[kind][step];
          const Icon = meta.icon;
          const stepState = workflow.currentStepIndex < 0
            ? 'upcoming'
            : index < workflow.currentStepIndex
              ? 'complete'
              : index === workflow.currentStepIndex
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

      {terminal ? (
        <div className={`${styles.requestTerminalState} ${currentStatus === 'rejected' || currentStatus === 'cancelled' ? styles.requestTerminalNegative : ''}`} role="status">
          {currentStatus === 'rejected' || currentStatus === 'cancelled' ? <CircleX size={18} aria-hidden="true" /> : <CircleCheckBig size={18} aria-hidden="true" />}
          <div>
            <strong>{statusLabel(currentStatus, lang)}</strong>
            {variant === 'detail' && <span>{t(description.vi, description.en)}</span>}
          </div>
        </div>
      ) : (
        <form action={formAction} className={styles.requestStatusForm} onSubmit={confirmExceptionalAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="locale" value={lang} />
          <div className={styles.orderStatusSummary}>
            <strong>{t(description.vi, description.en)}</strong>
            {variant === 'detail' && <span>{t(`${statusLabel(currentStatus, 'vi')} · bước tiếp theo`, `${statusLabel(currentStatus, 'en')} · next step`)}</span>}
          </div>
          <div className={styles.requestStatusActions}>
            {workflow.nextStatus && (
              <button type="submit" name="status" value={workflow.nextStatus} className={styles.nextStatusButton} disabled={pending}>
                {pending ? <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                <span>{pending ? t('Đang cập nhật...', 'Updating...') : t(ACTION_LABELS[kind][workflow.nextStatus].vi, ACTION_LABELS[kind][workflow.nextStatus].en)}</span>
              </button>
            )}
            {workflow.secondaryStatuses.map((status) => (
              <button key={status} type="submit" name="status" value={status} className={styles.requestSecondaryButton} disabled={pending}>
                <X size={15} aria-hidden="true" />
                <span><LocalizedText vi={ACTION_LABELS[kind][status].vi} en={ACTION_LABELS[kind][status].en} /></span>
              </button>
            ))}
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
