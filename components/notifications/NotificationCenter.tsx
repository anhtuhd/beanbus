'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Mail, Save, Smartphone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { NotificationRichText } from './NotificationRichText';
import styles from './notification-center.module.css';

type Notification = Database['public']['Tables']['notifications']['Row'];
type Preferences = Database['public']['Tables']['notification_preferences']['Row'];
type Failure = {
  id: string;
  notification_id: string;
  recipient_email: string;
  attempt_count: number;
  last_error_code: string | null;
  updated_at: string;
};

type Props = {
  initialNotifications: Notification[];
  recipientId: string;
  initialHasMore?: boolean;
  initialPreferences?: Preferences | null;
  initialError?: string;
  failures?: Failure[];
  isAdmin?: boolean;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export default function NotificationCenter({
  initialNotifications,
  recipientId,
  initialHasMore = false,
  initialPreferences,
  initialError,
  failures = [],
  isAdmin = false,
}: Props) {
  const { lang, t } = useLanguage();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preferences, setPreferences] = useState({
    ...(initialPreferences ?? {
      user_id: '',
      email_order_updates: true,
      email_event_updates: false,
      email_store_updates: false,
      push_order_updates: true,
      push_request_updates: true,
      push_event_updates: false,
      push_store_updates: false,
      created_at: '',
      updated_at: '',
    }),
    email_order_updates: true,
  });
  const [message, setMessage] = useState(initialError ?? '');
  const unread = notifications.filter((notification) => !notification.read_at).length;

  const markRead = async (id: string) => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
    if (error) {
      setMessage('Không thể cập nhật trạng thái thông báo.');
      return;
    }
    setNotifications((current) => current.map((notification) => notification.id === id
      ? { ...notification, read_at: notification.read_at ?? new Date().toISOString() }
      : notification));
  };

  const markAllRead = async () => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      setMessage('Không thể cập nhật trạng thái thông báo.');
      return;
    }
    const now = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at ?? now })));
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const supabase = createBrowserSupabaseClient();
    const from = notifications.length;
    const { data, count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_user_id', recipientId)
      .order('created_at', { ascending: false })
      .range(from, from + 49);
    setLoadingMore(false);
    if (error) {
      setMessage('Không thể tải thêm thông báo.');
      return;
    }
    setNotifications((current) => {
      const existing = new Set(current.map((notification) => notification.id));
      return [...current, ...(data ?? []).filter((notification) => !existing.has(notification.id))];
    });
    setHasMore(from + (data?.length ?? 0) < (count ?? from + (data?.length ?? 0)));
  };

  const savePreferences = async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc('update_notification_preferences', {
      p_email_order_updates: true,
      p_email_event_updates: preferences.email_event_updates,
      p_email_store_updates: preferences.email_store_updates,
    });
    if (error || !data) {
      setMessage('Không thể lưu lựa chọn email.');
      return;
    }
    setPreferences(data);
    setMessage('Đã lưu lựa chọn email.');
  };

  const savePushPreferences = async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc('update_push_notification_preferences', {
      p_push_order_updates: preferences.push_order_updates,
      p_push_request_updates: preferences.push_request_updates,
      p_push_event_updates: preferences.push_event_updates,
      p_push_store_updates: preferences.push_store_updates,
    });
    if (error || !data) {
      setMessage('Không thể lưu lựa chọn thông báo thiết bị.');
      return;
    }
    setPreferences(data);
    setMessage('Đã lưu lựa chọn thông báo thiết bị.');
  };

  return (
    <div className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><Bell size={15} /> {t('Trung tâm thông báo', 'Notification center')}</span>
          <h1>{isAdmin ? t('Thông báo vận hành', 'Operations notifications') : t('Thông báo của bạn', 'Your notifications')}</h1>
          <p>{unread > 0 ? t(`${unread} thông báo chưa đọc.`, `${unread} unread notification${unread === 1 ? '' : 's'}.`) : t('Bạn đã đọc hết thông báo.', 'You are all caught up.')}</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={() => void markAllRead()} disabled={unread === 0}>
          <CheckCheck size={16} /> {t('Đánh dấu tất cả đã đọc', 'Mark all as read')}
        </button>
      </header>

      {message && <p className={styles.feedback} role="status">{message}</p>}

      <section className={styles.list} aria-label={t('Danh sách thông báo', 'Notification list')}>
        {notifications.length === 0 ? (
          <div className={styles.empty}><Bell size={28} /><p>{t('Chưa có thông báo nào.', 'No notifications yet.')}</p></div>
        ) : notifications.map((notification) => (
          <article key={notification.id} className={`${styles.item} ${notification.read_at ? '' : styles.unread}`}>
            <div className={styles.itemIcon}><Bell size={17} /></div>
            <div className={styles.itemBody}>
              <h2>{lang === 'en' ? notification.title_en : notification.title_vi}</h2>
              <NotificationRichText value={lang === 'en' ? notification.body_en : notification.body_vi} />
              <time dateTime={notification.created_at}>{displayDate(notification.created_at)}</time>
            </div>
            <div className={styles.itemActions}>
              {notification.href && <Link href={notification.href} className={styles.link} onClick={() => void markRead(notification.id)}>{t('Xem chi tiết', 'View details')}</Link>}
              {!notification.read_at && <button type="button" className={styles.iconButton} aria-label={t('Đánh dấu đã đọc', 'Mark as read')} onClick={() => void markRead(notification.id)}><Check size={16} /></button>}
            </div>
          </article>
        ))}
      </section>

      {hasMore && (
        <div className={styles.loadMore}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? t('Đang tải...', 'Loading...') : t('Tải thêm thông báo', 'Load more notifications')}
          </button>
        </div>
      )}

      {!isAdmin && (
        <>
          <section className={styles.preferences}>
            <div className={styles.preferenceHeading}>
            <Mail size={19} />
            <div><h2>{t('Lựa chọn email', 'Email preferences')}</h2><p>{t('Email cập nhật đơn hàng luôn được bật để không bỏ lỡ thông tin giao dịch.', 'Order update emails stay enabled so you do not miss transaction details.')}</p></div>
          </div>
          <p className={styles.checkRow}><Check size={15} /> {t('Email cập nhật đơn hàng luôn bật', 'Order update emails are always enabled')}</p>
          <label className={styles.checkRow}><input type="checkbox" checked={preferences.email_event_updates} onChange={(event) => setPreferences({ ...preferences, email_event_updates: event.target.checked })} /> {t('Email sự kiện Beanbus', 'Beanbus event emails')}</label>
          <label className={styles.checkRow}><input type="checkbox" checked={preferences.email_store_updates} onChange={(event) => setPreferences({ ...preferences, email_store_updates: event.target.checked })} /> {t('Email thông báo từ cửa hàng', 'Store announcement emails')}</label>
          <button type="button" className={styles.primaryButton} onClick={() => void savePreferences()}><Save size={16} /> {t('Lưu lựa chọn', 'Save preferences')}</button>
          </section>
          {process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true' && (
            <section className={styles.preferences}>
              <div className={styles.preferenceHeading}>
                <Smartphone size={19} />
                <div><h2>{t('Thông báo thiết bị', 'Device notifications')}</h2><p>{t('Chọn loại cập nhật được gửi tới trình duyệt đã bật thông báo.', 'Choose which updates are sent to browsers with notifications enabled.')}</p></div>
              </div>
              <label className={styles.checkRow}><input type="checkbox" checked={preferences.push_order_updates} onChange={(event) => setPreferences({ ...preferences, push_order_updates: event.target.checked })} /> {t('Trạng thái và thanh toán đơn hàng', 'Order and payment updates')}</label>
              <label className={styles.checkRow}><input type="checkbox" checked={preferences.push_request_updates} onChange={(event) => setPreferences({ ...preferences, push_request_updates: event.target.checked })} /> {t('Đặt bàn và yêu cầu', 'Bookings and requests')}</label>
              <label className={styles.checkRow}><input type="checkbox" checked={preferences.push_event_updates} onChange={(event) => setPreferences({ ...preferences, push_event_updates: event.target.checked })} /> {t('Sự kiện Beanbus', 'Beanbus events')}</label>
              <label className={styles.checkRow}><input type="checkbox" checked={preferences.push_store_updates} onChange={(event) => setPreferences({ ...preferences, push_store_updates: event.target.checked })} /> {t('Thông báo từ cửa hàng', 'Store announcements')}</label>
              <button type="button" className={styles.primaryButton} onClick={() => void savePushPreferences()}><Save size={16} /> {t('Lưu lựa chọn', 'Save preferences')}</button>
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <section className={styles.failures}>
          <h2>{t('Email lỗi gần đây', 'Recent email failures')}</h2>
          {failures.length === 0 ? <p>{t('Chưa có email lỗi.', 'No failed emails.')}</p> : failures.map((failure) => (
            <div key={failure.id} className={styles.failureRow}>
              <span>{failure.recipient_email}</span>
              <span>{failure.last_error_code ?? 'UNKNOWN'} · {failure.attempt_count} lần thử</span>
              <time dateTime={failure.updated_at}>{displayDate(failure.updated_at)}</time>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
