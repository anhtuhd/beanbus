export type PasswordManagementState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const initialPasswordManagementState: PasswordManagementState = {
  status: 'idle',
  message: '',
};
