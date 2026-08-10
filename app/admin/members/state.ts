export type MemberRoleActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const initialMemberRoleActionState: MemberRoleActionState = { status: 'idle' };
