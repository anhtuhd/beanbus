'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateMemberRole } from './actions';
import { initialMemberRoleActionState } from './state';
import styles from '../requests/requests.module.css';
import type { Database } from '@/lib/supabase/database.types';

type Props = {
  userId: string;
  role: Database['public']['Enums']['app_role'];
};

export default function MemberRoleForm({ userId, role }: Props) {
  const [state, formAction, pending] = useActionState(updateMemberRole, initialMemberRoleActionState);

  return (
    <form action={formAction} className={styles.statusForm}>
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={role} aria-label="Quyền hội viên" disabled={pending}>
        <option value="member">member</option>
        <option value="staff">staff</option>
        <option value="admin">admin</option>
      </select>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu quyền hội viên">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span>{pending ? 'Đang lưu' : 'Lưu'}</span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
