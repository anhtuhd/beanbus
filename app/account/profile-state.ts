export type ProfileUpdateState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const initialProfileUpdateState: ProfileUpdateState = { status: 'idle' };
