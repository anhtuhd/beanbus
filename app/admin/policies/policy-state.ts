export type CommercePolicyState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialCommercePolicyState: CommercePolicyState = { status: 'idle', message: '' };
