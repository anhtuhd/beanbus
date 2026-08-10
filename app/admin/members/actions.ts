'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { MemberRoleActionState } from './state';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = ['member', 'staff', 'admin'] as const;
type AppRole = Database['public']['Enums']['app_role'];

export async function updateMemberRole(
  _previousState: MemberRoleActionState,
  formData: FormData
): Promise<MemberRoleActionState> {
  await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as AppRole;
  if (!UUID.test(userId) || !ROLES.includes(role)) {
    return { status: 'error', message: 'Dữ liệu quyền hội viên không hợp lệ.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('update_member_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) {
    const message = error.message.includes('SELF_DEMOTION_FORBIDDEN')
      ? 'Không thể tự hạ quyền tài khoản đang đăng nhập.'
      : 'Không thể cập nhật quyền hội viên.';
    return { status: 'error', message };
  }

  revalidatePath('/admin/members');
  revalidatePath(`/admin/members/${userId}`);
  return { status: 'success', message: 'Đã cập nhật quyền.' };
}
