'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminEvent } from './event-actions';
import { initialContentEditorState } from './content-editor-state';
import styles from '../requests/requests.module.css';

type Event = Pick<Database['public']['Tables']['events']['Row'], 'id' | 'slug' | 'title_vi' | 'title_en' | 'summary_vi' | 'summary_en' | 'description_vi' | 'description_en' | 'starts_at' | 'ends_at' | 'time_label' | 'location' | 'image_url' | 'max_seats' | 'is_featured' | 'is_published' | 'sort_order'>;

function localDateTime(value?: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}T${map.get('hour')}:${map.get('minute')}`;
}

export default function EventEditorForm({ event }: { event?: Event }) {
  const [state, formAction, pending] = useActionState(upsertAdminEvent, initialContentEditorState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <input type="hidden" name="eventId" value={event?.id ?? ''} />
      <div className={styles.editorGrid}>
        <label>Slug<input name="slug" defaultValue={event?.slug ?? ''} pattern="[a-z0-9][a-z0-9-]*" required /></label>
        <label>Tiêu đề tiếng Việt<input name="titleVi" defaultValue={event?.title_vi ?? ''} maxLength={180} required /></label>
        <label>Tiêu đề tiếng Anh<input name="titleEn" defaultValue={event?.title_en ?? ''} maxLength={180} required /></label>
        <label>Bắt đầu<input name="startsAt" type="datetime-local" defaultValue={localDateTime(event?.starts_at)} required /></label>
        <label>Kết thúc<input name="endsAt" type="datetime-local" defaultValue={localDateTime(event?.ends_at)} /></label>
        <label>Khung giờ<input name="timeLabel" defaultValue={event?.time_label ?? ''} maxLength={50} required /></label>
        <label>Địa điểm<input name="location" defaultValue={event?.location ?? ''} maxLength={300} required /></label>
        <label>Ảnh HTTPS<input name="imageUrl" type="url" defaultValue={event?.image_url ?? ''} required /></label>
        <label>Số chỗ<input name="maxSeats" type="number" min="1" step="1" defaultValue={event?.max_seats ?? ''} /></label>
        <label>Thứ tự<input name="sortOrder" type="number" min="0" step="1" defaultValue={event?.sort_order ?? 0} required /></label>
      </div>
      <div className={styles.editorTextareas}>
        <label>Tóm tắt tiếng Việt<textarea name="summaryVi" defaultValue={event?.summary_vi ?? ''} maxLength={500} rows={2} required /></label>
        <label>Tóm tắt tiếng Anh<textarea name="summaryEn" defaultValue={event?.summary_en ?? ''} maxLength={500} rows={2} required /></label>
        <label>Mô tả tiếng Việt<textarea name="descriptionVi" defaultValue={event?.description_vi ?? ''} maxLength={10000} rows={4} required /></label>
        <label>Mô tả tiếng Anh<textarea name="descriptionEn" defaultValue={event?.description_en ?? ''} maxLength={10000} rows={4} required /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isFeatured" defaultChecked={event?.is_featured ?? false} /> Nổi bật</label>
        <label><input type="checkbox" name="isPublished" defaultChecked={event?.is_published ?? false} /> Công khai</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span>{pending ? 'Đang lưu' : 'Lưu sự kiện'}</span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
