import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAppMode, isNotificationsEnabled } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import AnnouncementForm from './AnnouncementForm';

export default async function AdminNotificationsPage() {
  if (getAppMode() === 'demo') redirect('/admin');
  if (!isNotificationsEnabled()) redirect('/admin');
  const profile = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const [notifications, failures, summary] = await Promise.all([
    supabase.from('notifications').select('*', { count: 'exact' }).eq('recipient_user_id', profile.id).order('created_at', { ascending: false }).range(0, 49),
    supabase.rpc('get_admin_notification_failures', { p_limit: 50, p_offset: 0 }),
    supabase.rpc('get_admin_notification_summary'),
  ]);
  const failureCount = summary.data?.[0]?.failed_email_count ?? failures.data?.length ?? 0;
  return (
    <>
      <main className="wrap" style={{ paddingTop: '40px' }}>
        <Link href="/admin" className="backLink"><ArrowLeft size={16} /> Tổng quan</Link>
      </main>
      <NotificationCenter
        initialNotifications={notifications.data ?? []}
        recipientId={profile.id}
        initialHasMore={(notifications.count ?? 0) > 50}
        initialError={notifications.error || failures.error || summary.error ? 'Không thể tải đầy đủ dữ liệu thông báo.' : undefined}
        failures={failures.data ?? []}
        initialFailureTotal={failureCount}
        isAdmin
      />
      <main className="wrap" style={{ paddingBottom: '80px' }}><AnnouncementForm /></main>
    </>
  );
}
