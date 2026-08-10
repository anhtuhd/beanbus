export type VoucherState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialVoucherState: VoucherState = { status: 'idle', message: '' };
