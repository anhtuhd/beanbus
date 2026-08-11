export type RefundOrderState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialRefundOrderState: RefundOrderState = { status: 'idle', message: '' };
