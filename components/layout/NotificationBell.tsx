'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import styles from './NotificationBell.module.css';

type NotificationItem = {
  id: string;
  title_vi: string;
  title_en: string;
  body_vi: string;
  body_en: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type Props = { isAdmin: boolean; isLoggedIn: boolean };

const enabled = process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true';

export function NotificationBell({ isAdmin, isLoggedIn }: Props) {
  const { lang, t } = useLanguage();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !isLoggedIn) return;
    const supabase = createBrowserSupabaseClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: claimsData } = await supabase.auth.getClaims();
      const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;
      if (!userId) return;
      const [recent, unread] = await Promise.all([
        supabase.from('notifications')
          .select('id, title_vi, title_en, body_vi, body_en, href, read_at, created_at')
          .eq('recipient_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_user_id', userId)
          .is('read_at', null),
      ]);
      if (!active) return;
      if (recent.error || unread.error) {
        setError(true);
        return;
      }
      setError(false);
      setItems((recent.data ?? []) as NotificationItem[]);
      setUnreadCount(unread.count ?? 0);
    };

    void load();
    void supabase.auth.getClaims().then(({ data }) => {
      if (!active) return;
      const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
      if (!userId || !active) return;
      channel = supabase.channel(`notifications:${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        }, () => void load())
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!enabled || !isLoggedIn) return null;

  const markRead = async (id: string) => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
    if (error) {
      setError(true);
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - (items.find((item) => item.id === id)?.read_at ? 0 : 1)));
  };

  const markAllRead = async () => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      setError(true);
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={t('Thông báo', 'Notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section id="notification-popover" className={styles.popover} role="dialog" aria-label={t('Thông báo mới', 'Recent notifications')}>
          <header className={styles.popoverHeader}>
            <h2>{t('Thông báo', 'Notifications')}</h2>
            <button type="button" className={styles.close} aria-label={t('Đóng thông báo', 'Close notifications')} onClick={() => setOpen(false)}><X size={17} /></button>
          </header>
          {items.length === 0 ? (
            <p className={styles.empty} role={error ? 'alert' : 'status'}>
              {error ? t('Không thể tải thông báo.', 'Notifications are unavailable.') : t('Chưa có thông báo mới.', 'No notifications yet.')}
            </p>
          ) : (
            <div className={styles.items}>
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? (isAdmin ? '/admin/notifications' : '/account/notifications')}
                  className={`${styles.item} ${item.read_at ? '' : styles.unread}`}
                  onClick={() => void markRead(item.id)}
                >
                  <strong>{lang === 'en' ? item.title_en : item.title_vi}</strong>
                  <span>{lang === 'en' ? item.body_en : item.body_vi}</span>
                  <time dateTime={item.created_at}>{new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }).format(new Date(item.created_at))}</time>
                </Link>
              ))}
            </div>
          )}
          <footer className={styles.footer}>
            <button type="button" className={styles.markAll} onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck size={15} /> {t('Đánh dấu đã đọc', 'Mark all as read')}
            </button>
            <Link href={isAdmin ? '/admin/notifications' : '/account/notifications'} onClick={() => setOpen(false)}>
              {t('Xem tất cả', 'View all')}
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
