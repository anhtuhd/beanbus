'use client';

import { useActionState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { initialAnnouncementState, publishAnnouncement } from './actions';
import styles from '@/components/notifications/notification-center.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function AnnouncementForm() {
  const [state, action, pending] = useActionState(publishAnnouncement, initialAnnouncementState);
  return (
    <form action={action} className={styles.preferences}>
      <div className={styles.preferenceHeading}><Megaphone size={19} /><div><h2>Thông báo cửa hàng</h2><p>Gửi ngay một thông báo tới toàn bộ hội viên.</p></div></div>
      <label>Tiêu đề tiếng Việt<input name="titleVi" minLength={3} maxLength={180} required /></label>
      <label>Tiêu đề tiếng Anh<input name="titleEn" minLength={3} maxLength={180} required /></label>
      <label>Nội dung tiếng Việt<textarea name="bodyVi" minLength={10} maxLength={1000} rows={4} required /></label>
      <label>Nội dung tiếng Anh<textarea name="bodyEn" minLength={10} maxLength={1000} rows={4} required /></label>
      <label>Đường dẫn nội bộ (không bắt buộc)<input name="href" placeholder="/events" pattern="^/(?!/).*" /></label>
      <label className={styles.checkRow}><input type="checkbox" name="sendEmail" /> Gửi email cho hội viên đã đăng ký tin cửa hàng</label>
      <button type="submit" className={styles.primaryButton} disabled={pending}><Send size={16} /> <LocalizedText vi={pending ? 'Đang gửi' : 'Phát hành thông báo'} en={pending ? 'Sending' : 'Publish announcement'} /></button>
      {state.status !== 'idle' && <p className={styles.feedback} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
    </form>
  );
}
