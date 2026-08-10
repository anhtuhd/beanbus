export type MemberPhoneState = {
  status: 'idle' | 'code-sent' | 'success' | 'error';
  message?: string;
  phone?: string;
  requestId?: string;
};

export const initialMemberPhoneState: MemberPhoneState = { status: 'idle' };
