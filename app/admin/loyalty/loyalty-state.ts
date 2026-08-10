export type LoyaltyPolicyState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialLoyaltyPolicyState: LoyaltyPolicyState = { status: 'idle', message: '' };
