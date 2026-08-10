export type RewardAdminState = { status: 'idle' | 'success' | 'error'; message: string };

export const initialRewardAdminState: RewardAdminState = { status: 'idle', message: '' };
