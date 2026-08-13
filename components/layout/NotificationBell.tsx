'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, LoaderCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  disableWebPush,
  enableWebPush,
  webPushStatus,
  type PushStatus,
} from '@/lib/notifications/firebase-client';
import { notificationPlainText } from '@/lib/notifications/rich-text';
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
  source: 'guest' | 'user';
};

type Props = {
  isAdmin: boolean;
  isAuthReady: boolean;
  isLoggedIn: boolean;
  userId: string | null;
};

type GuestResponse = {
  guestSession?: boolean;
  items?: Omit<NotificationItem, 'source'>[];
  unreadCount?: number;
};

const enabled = process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true';
const guestEnabled = process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS === 'true';
const webPushEnabled = process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true';

export function NotificationBell({ isAdmin, isAuthReady, isLoggedIn, userId }: Props) {
  const { lang, t } = useLanguage();
  const [userItems, setUserItems] = useState<NotificationItem[]>([]);
  const [guestItems, setGuestItems] = useState<NotificationItem[]>([]);
  const [userUnread, setUserUnread] = useState(0);
  const [guestUnread, setGuestUnread] = useState(0);
  const [guestSessionPresent, setGuestSessionPresent] = useState<boolean | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('disabled');
  const [pushBusy, setPushBusy] = useState(false);
  const [toast, setToast] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }), [lang]);
  const items = useMemo(() => [...(isLoggedIn ? userItems : []), ...guestItems]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, 5), [guestItems, isLoggedIn, userItems]);
  const unreadCount = (isLoggedIn ? userUnread : 0) + guestUnread;
  const loading = userLoading || guestLoading;
  const viewAllHref = isAdmin
    ? '/admin/notifications'
    : isLoggedIn
      ? '/account/notifications'
      : '/notifications';

  const loadGuest = useCallback(async () => {
    if (!enabled || !guestEnabled || !isAuthReady) return;
    setGuestLoading(true);
    try {
      const response = await fetch('/api/notifications/guest', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('GUEST_NOTIFICATION_LOAD_FAILED');
      const data = await response.json() as GuestResponse;
      setGuestSessionPresent(data.guestSession === true);
      setGuestItems((data.items ?? []).map((item) => ({ ...item, source: 'guest' })));
      setGuestUnread(data.unreadCount ?? 0);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setGuestLoading(false);
    }
  }, [isAuthReady]);

  useEffect(() => {
    if (!enabled || !isAuthReady || !isLoggedIn || !userId) return;
    const supabase = createBrowserSupabaseClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      setUserLoading(true);
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
      setUserLoading(false);
      if (recent.error || unread.error) {
        setError(true);
        return;
      }
      setError(false);
      setUserItems(((recent.data ?? []) as Omit<NotificationItem, 'source'>[])
        .map((item) => ({ ...item, source: 'user' })));
      setUserUnread(unread.count ?? 0);
    };

    void load();
    const refresh = () => void load();
    window.addEventListener('beanbus:fcm-message', refresh);
    channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${userId}`,
      }, refresh)
      .subscribe();
    return () => {
      active = false;
      window.removeEventListener('beanbus:fcm-message', refresh);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isAuthReady, isLoggedIn, userId]);

  useEffect(() => {
    if (!enabled || !guestEnabled || !isAuthReady) return;
    const initialLoad = window.setTimeout(() => void loadGuest(), 0);
    const interval = window.setInterval(() => void loadGuest(), 30_000);
    const refreshOnFocus = () => void loadGuest();
    const refreshOnMessage = () => void loadGuest();
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('beanbus:fcm-message', refreshOnMessage);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialLoad);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('beanbus:fcm-message', refreshOnMessage);
    };
  }, [isAuthReady, loadGuest]);

  useEffect(() => {
    if (!webPushEnabled || !isAuthReady || (!isLoggedIn && guestSessionPresent !== true)) return;
    void webPushStatus().then(setPushStatus);
    const statusListener = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: PushStatus }>).detail;
      if (detail?.status) setPushStatus(detail.status);
    };
    const foregroundListener = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const title = lang === 'en' ? detail.titleEn : detail.titleVi;
      setToast(typeof title === 'string' ? title.slice(0, 180) : lang === 'en' ? 'You have a new notification.' : 'Bạn có thông báo mới.');
    };
    const serviceWorkerListener = (event: MessageEvent) => {
      if (event.data?.type === 'beanbus:fcm-message') {
        window.dispatchEvent(new CustomEvent('beanbus:fcm-message'));
      }
    };
    window.addEventListener('beanbus:push-status', statusListener);
    window.addEventListener('beanbus:fcm-message', foregroundListener);
    navigator.serviceWorker?.addEventListener('message', serviceWorkerListener);
    return () => {
      window.removeEventListener('beanbus:push-status', statusListener);
      window.removeEventListener('beanbus:fcm-message', foregroundListener);
      navigator.serviceWorker?.removeEventListener('message', serviceWorkerListener);
    };
  }, [guestSessionPresent, isAuthReady, isLoggedIn, lang]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => closeRef.current?.focus());
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!enabled || !isAuthReady || (!isLoggedIn && (!guestEnabled || guestSessionPresent !== true))) return null;

  const markRead = async (item: NotificationItem) => {
    let failed = false;
    if (item.source === 'user') {
      const { error: rpcError } = await createBrowserSupabaseClient()
        .rpc('mark_notification_read', { p_notification_id: item.id });
      failed = Boolean(rpcError);
    } else {
      const response = await fetch('/api/notifications/guest', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      failed = !response.ok;
    }
    if (failed) {
      setError(true);
      return;
    }
    const update = (current: NotificationItem[]) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, read_at: candidate.read_at ?? new Date().toISOString() }
      : candidate);
    if (item.source === 'user') {
      if (!item.read_at) setUserUnread((count) => Math.max(0, count - 1));
      setUserItems(update);
    } else {
      if (!item.read_at) setGuestUnread((count) => Math.max(0, count - 1));
      setGuestItems(update);
    }
  };

  const markAllRead = async () => {
    const requests: Promise<unknown>[] = [];
    if (isLoggedIn) requests.push((async () => {
      const { error: rpcError } = await createBrowserSupabaseClient().rpc('mark_all_notifications_read');
      if (rpcError) throw new Error('USER_MARK_ALL_FAILED');
    })());
    if (guestEnabled && guestSessionPresent) requests.push(fetch('/api/notifications/guest', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }));
    const results = await Promise.allSettled(requests);
    if (results.some((result) => result.status === 'rejected' ||
      (result.status === 'fulfilled' && result.value instanceof Response && !result.value.ok))) {
      setError(true);
      return;
    }
    const now = new Date().toISOString();
    const update = (current: NotificationItem[]) => current.map((item) => ({ ...item, read_at: item.read_at ?? now }));
    setUserItems(update);
    setGuestItems(update);
    setUserUnread(0);
    setGuestUnread(0);
  };

  const togglePush = async () => {
    if (pushBusy || pushStatus === 'denied') return;
    setPushBusy(true);
    const next = pushStatus === 'enabled' ? await disableWebPush() : await enableWebPush();
    setPushStatus(next);
    setPushBusy(false);
  };

  const pushLabel = pushStatus === 'enabled'
    ? t('Tắt thông báo thiết bị', 'Disable device notifications')
    : pushStatus === 'denied'
      ? t('Đã chặn trong trình duyệt', 'Blocked in browser settings')
      : t('Bật thông báo thiết bị', 'Enable device notifications');

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
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
      {toast && <p className={styles.toast} role="status">{toast}</p>}
      {open && (
        <section id="notification-popover" className={styles.popover} role="dialog" aria-label={t('Thông báo mới', 'Recent notifications')}>
          <header className={styles.popoverHeader}>
            <h2>{t('Thông báo', 'Notifications')}</h2>
            <button ref={closeRef} type="button" className={styles.close} aria-label={t('Đóng thông báo', 'Close notifications')} onClick={() => {
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}><X size={17} /></button>
          </header>
          {loading && items.length === 0 ? (
            <p className={styles.empty} role="status"><LoaderCircle className={styles.spinner} size={18} /> {t('Đang tải...', 'Loading...')}</p>
          ) : items.length === 0 ? (
            <p className={styles.empty} role={error ? 'alert' : 'status'}>
              {error ? t('Không thể tải thông báo.', 'Notifications are unavailable.') : t('Chưa có thông báo mới.', 'No notifications yet.')}
            </p>
          ) : (
            <div className={styles.items}>
              {items.map((item) => (
                <Link
                  key={`${item.source}:${item.id}`}
                  href={item.href ?? viewAllHref}
                  className={`${styles.item} ${item.read_at ? '' : styles.unread}`}
                  onClick={() => void markRead(item)}
                >
                  <strong>{lang === 'en' ? item.title_en : item.title_vi}</strong>
                  <span>{notificationPlainText(lang === 'en' ? item.body_en : item.body_vi)}</span>
                  <time dateTime={item.created_at}>{dateFormatter.format(new Date(item.created_at))}</time>
                </Link>
              ))}
            </div>
          )}
          {webPushEnabled && pushStatus !== 'unsupported' && pushStatus !== 'disabled' && (
            <div className={styles.pushControl}>
              <button type="button" onClick={() => void togglePush()} disabled={pushBusy || pushStatus === 'denied'}>
                {pushStatus === 'enabled' ? <BellOff size={15} /> : <Bell size={15} />}
                {pushBusy ? t('Đang cập nhật...', 'Updating...') : pushLabel}
              </button>
              {pushStatus === 'denied' && <small>{t('Mở cài đặt website của trình duyệt để cấp lại quyền.', 'Use your browser site settings to allow notifications.')}</small>}
            </div>
          )}
          <footer className={styles.footer}>
            <button type="button" className={styles.markAll} onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck size={15} /> {t('Đánh dấu đã đọc', 'Mark all as read')}
            </button>
            <Link href={viewAllHref} onClick={() => setOpen(false)}>
              {t('Xem tất cả', 'View all')}
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
