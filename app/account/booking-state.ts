export type MemberBookingCancelState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const initialMemberBookingCancelState: MemberBookingCancelState = { status: 'idle', message: '' };
