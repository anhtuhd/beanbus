'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminVoucher } from './actions';
import { initialVoucherState } from './voucher-state';
import styles from '../requests/requests.module.css';

type Voucher = Pick<Database['public']['Tables']['vouchers']['Row'], 'code' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd' | 'starts_at' | 'ends_at' | 'usage_limit' | 'is_active'>;

function localDateTime(value?: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}`;
}

export default function VoucherEditorForm({ voucher }: { voucher?: Voucher }) {
  const [state, formAction, pending] = useActionState(upsertAdminVoucher, initialVoucherState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <div className={styles.editorGrid}>
        <label>Mã voucher<input name="code" defaultValue={voucher?.code ?? ''} pattern="[A-Z0-9][A-Z0-9_-]*" disabled={Boolean(voucher)} required /></label>
        <label>Loại<select name="discountType" defaultValue={voucher?.discount_type ?? 'percent'}><option value="percent">Phần trăm</option><option value="fixed">Số tiền</option></select></label>
        <label>Giá trị<input name="discountValue" type="number" min="1" step="1" defaultValue={voucher?.discount_value ?? ''} required /></label>
        <label>Đơn tối thiểu<input name="minimumSubtotalVnd" type="number" min="0" step="1000" defaultValue={voucher?.minimum_subtotal_vnd ?? 0} required /></label>
        <label>Giảm tối đa<input name="maximumDiscountVnd" type="number" min="1" step="1000" defaultValue={voucher?.maximum_discount_vnd ?? ''} /></label>
        <label>Giới hạn lượt dùng<input name="usageLimit" type="number" min="1" step="1" defaultValue={voucher?.usage_limit ?? ''} /></label>
        <label>Bắt đầu<input name="startsAt" type="datetime-local" defaultValue={localDateTime(voucher?.starts_at)} /></label>
        <label>Kết thúc<input name="endsAt" type="datetime-local" defaultValue={localDateTime(voucher?.ends_at)} /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isActive" defaultChecked={voucher?.is_active ?? true} /> Đang hoạt động</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span>{pending ? 'Đang lưu' : 'Lưu voucher'}</span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
