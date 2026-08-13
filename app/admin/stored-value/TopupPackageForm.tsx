'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminTopupPackage } from './actions';
import { initialStoredValueAdminState } from './stored-value-state';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Package = Database['public']['Tables']['topup_packages']['Row'];

export default function TopupPackageForm({ item }: { item?: Package }) {
  const [state, formAction, pending] = useActionState(upsertAdminTopupPackage, initialStoredValueAdminState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <input type="hidden" name="packageId" value={item?.id ?? ''} />
      <div className={styles.editorGrid}>
        <label>Tên VI<input name="nameVi" defaultValue={item?.name_vi ?? ''} minLength={3} maxLength={180} required /></label>
        <label>Tên EN<input name="nameEn" defaultValue={item?.name_en ?? ''} minLength={3} maxLength={180} required /></label>
        <label>Số tiền (VND)<input name="amountVnd" type="number" min="1" step="1" defaultValue={item?.amount_vnd ?? ''} required /></label>
        <label>Điểm cộng<input name="points" type="number" min="1" step="1" defaultValue={item?.points ?? ''} required /></label>
        <label>Thứ tự<input name="sortOrder" type="number" min="0" step="1" defaultValue={item?.sort_order ?? 0} required /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isActive" defaultChecked={item?.is_active ?? false} /> Hiển thị</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span><LocalizedText vi={pending ? 'Đang lưu' : item ? 'Cập nhật gói' : 'Tạo gói'} en={pending ? 'Saving...' : item ? 'Update package' : 'Create package'} /></span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
