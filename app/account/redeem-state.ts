export type RedeemState = { status: 'idle' | 'success' | 'error'; message: string; voucherCode?: string };

export const initialRedeemState: RedeemState = { status: 'idle', message: '' };
