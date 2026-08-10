export type PhoneAuthState = {
  status: 'idle' | 'code-sent' | 'error';
  message?: string;
  phone?: string;
};

export const initialPhoneAuthState: PhoneAuthState = { status: 'idle' };
