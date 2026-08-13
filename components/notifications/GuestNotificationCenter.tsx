'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, LoaderCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './notification-center.module.css';

type GuestItem = {
  id: string;
  title_vi: string;
  title_en: string;
  body_vi: string;
  body_en: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export default function GuestNotificationCenter() {
  const { lang, t } = useLanguage();
  const [items, setItems] = useState<GuestItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }), [lang]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/guest', { cache: 'no-store' });
      if (!response.ok) throw new Error('LOAD_FAILED');
      const data = await response.json() as { items?: GuestItem[]; unreadCount?: number };
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
      setMessage('');
    } catch {
      setMessage(lang === 'en' ? 'Notifications are unavailable.' : 'Không thể tải thông báo lúc này.');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('beanbus:fcm-message', refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('beanbus:fcm-message', refresh);
    };
  }, [load]);

  const markRead = async (id?: string) => {
    const wasUnread = id ? items.some((item) => item.id === id && !item.read_at) : unread > 0;
    const response = await fetch('/api/notifications/guest', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (!response.ok) {
      setMessage(t('Không thể cập nhật thông báo.', 'Could not update notifications.'));
      return;
    }
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => !id || item.id === id
      ? { ...item, read_at: item.read_at ?? now }
      : item));
    setUnread((current) => id && wasUnread ? Math.max(0, current - 1) : id ? current : 0);
  };

  return (
    <div className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><Bell size={15} /> {t('Thông báo đơn khách', 'Guest order notifications')}</span>
          <h1>{t('Cập nhật đơn hàng', 'Order updates')}</h1>
          <p>{t('Thông báo của tối đa 5 đơn gần nhất trên trình duyệt này được giữ trong 7 ngày.', 'Updates for up to five recent orders on this browser are kept for seven days.')}</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={() => void markRead()} disabled={unread === 0}>
          <CheckCheck size={16} /> {t('Đánh dấu tất cả đã đọc', 'Mark all as read')}
        </button>
      </header>

      {message && <p className={styles.feedback} role="alert">{message}</p>}
      <section className={styles.list} aria-label={t('Danh sách thông báo', 'Notification list')}>
        {loading ? (
          <div className={styles.empty}><LoaderCircle size={24} /><p>{t('Đang tải...', 'Loading...')}</p></div>
        ) : items.length === 0 ? (
          <div className={styles.empty}><Bell size={28} /><p>{t('Chưa có cập nhật đơn hàng trên trình duyệt này.', 'No order updates on this browser yet.')}</p></div>
        ) : items.map((item) => (
          <article key={item.id} className={`${styles.item} ${item.read_at ? '' : styles.unread}`}>
            <div className={styles.itemIcon}><Bell size={17} /></div>
            <div className={styles.itemBody}>
              <h2>{lang === 'en' ? item.title_en : item.title_vi}</h2>
              <p>{lang === 'en' ? item.body_en : item.body_vi}</p>
              <time dateTime={item.created_at}>{dateFormatter.format(new Date(item.created_at))}</time>
            </div>
            <div className={styles.itemActions}>
              <Link href={item.href} className={styles.link} onClick={() => void markRead(item.id)}>{t('Xem chi tiết', 'View details')}</Link>
              {!item.read_at && <button type="button" className={styles.iconButton} aria-label={t('Đánh dấu đã đọc', 'Mark as read')} onClick={() => void markRead(item.id)}><Check size={16} /></button>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
