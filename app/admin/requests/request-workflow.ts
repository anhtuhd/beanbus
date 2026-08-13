export type RequestKind = 'booking' | 'customer';

export type RequestStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'in_progress'
  | 'resolved';

export const REQUEST_WORKFLOW_STEPS: Record<RequestKind, readonly RequestStatus[]> = {
  booking: ['pending', 'confirmed', 'completed'],
  customer: ['pending', 'in_progress', 'resolved'],
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, { vi: string; en: string }> = {
  pending: { vi: 'Chờ xử lý', en: 'Pending' },
  confirmed: { vi: 'Đã xác nhận', en: 'Confirmed' },
  completed: { vi: 'Hoàn tất', en: 'Completed' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
  rejected: { vi: 'Từ chối', en: 'Rejected' },
  in_progress: { vi: 'Đang xử lý', en: 'In progress' },
  resolved: { vi: 'Đã giải quyết', en: 'Resolved' },
};

type RequestWorkflow = {
  currentStepIndex: number;
  nextStatus: RequestStatus | null;
  secondaryStatuses: RequestStatus[];
  terminal: boolean;
};

const NEXT_STATUS: Record<RequestKind, Partial<Record<RequestStatus, RequestStatus>>> = {
  booking: { pending: 'confirmed', confirmed: 'completed' },
  customer: { pending: 'in_progress', in_progress: 'resolved' },
};

const SECONDARY_STATUSES: Record<RequestKind, Partial<Record<RequestStatus, RequestStatus[]>>> = {
  booking: { pending: ['rejected', 'cancelled'], confirmed: ['cancelled'] },
  customer: { pending: ['rejected'], in_progress: ['rejected'] },
};

export function getRequestWorkflow(kind: RequestKind, currentStatus: string): RequestWorkflow {
  const steps = REQUEST_WORKFLOW_STEPS[kind];
  const currentStepIndex = steps.indexOf(currentStatus as RequestStatus);
  const nextStatus = NEXT_STATUS[kind][currentStatus as RequestStatus] ?? null;
  const secondaryStatuses = SECONDARY_STATUSES[kind][currentStatus as RequestStatus] ?? [];

  return {
    currentStepIndex,
    nextStatus,
    secondaryStatuses,
    terminal: nextStatus === null,
  };
}
