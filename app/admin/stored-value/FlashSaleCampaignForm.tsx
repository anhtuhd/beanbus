'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminFlashSaleCampaign } from './actions';
import { initialStoredValueAdminState } from './stored-value-state';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Campaign = Database['public']['Tables']['flash_sale_campaigns']['Row'];

function localDateTime(value?: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}`;
}

export default function FlashSaleCampaignForm({ item }: { item?: Campaign }) {
  const [state, formAction, pending] = useActionState(upsertAdminFlashSaleCampaign, initialStoredValueAdminState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <input type="hidden" name="campaignId" value={item?.id ?? ''} />
      <div className={styles.editorGrid}>
        <label>Slug<input name="slug" defaultValue={item?.slug ?? ''} pattern="[a-z0-9][a-z0-9-]*" required /></label>
        <label>Tên VI<input name="nameVi" defaultValue={item?.name_vi ?? ''} minLength={3} maxLength={180} required /></label>
        <label>Tên EN<input name="nameEn" defaultValue={item?.name_en ?? ''} minLength={3} maxLength={180} required /></label>
        <label>Giá (VND)<input name="priceVnd" type="number" min="1" step="1" defaultValue={item?.price_vnd ?? ''} required /></label>
        <label>Điểm cộng<input name="points" type="number" min="1" step="1" defaultValue={item?.points ?? ''} required /></label>
        <label>Bắt đầu<input name="startsAt" type="datetime-local" defaultValue={localDateTime(item?.starts_at)} required /></label>
        <label>Kết thúc<input name="endsAt" type="datetime-local" defaultValue={localDateTime(item?.ends_at)} required /></label>
        <label>Tổng quota<input name="quotaTotal" type="number" min="1" step="1" defaultValue={item?.quota_total ?? ''} /></label>
        <label>Giới hạn / user<input name="maxPerUser" type="number" min="1" step="1" defaultValue={item?.max_per_user ?? ''} /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isActive" defaultChecked={item?.is_active ?? false} /> Hoạt động</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span><LocalizedText vi={pending ? 'Đang lưu' : item ? 'Cập nhật campaign' : 'Tạo campaign'} en={pending ? 'Saving...' : item ? 'Update campaign' : 'Create campaign'} /></span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
