import { redirect } from 'next/navigation';
import { getAppMode, isNotificationsEnabled } from '@/lib/env';
import { requireProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import NotificationCenter from '@/components/notifications/NotificationCenter';

export default async function MemberNotificationsPage() {
  if (getAppMode() === 'demo') redirect('/account');
  if (!isNotificationsEnabled()) redirect('/account');
  const profile = await requireProfile('/account/notifications');
  if (profile.role === 'admin') redirect('/admin/notifications');
  const supabase = await createServerSupabaseClient();
  const [notifications, preferences] = await Promise.all([
    supabase.from('notifications').select('*').eq('recipient_user_id', profile.id).order('created_at', { ascending: false }).range(0, 49),
    supabase.from('notification_preferences').select('*').eq('user_id', profile.id).maybeSingle(),
  ]);
  return (
    <NotificationCenter
      initialNotifications={notifications.data ?? []}
      initialPreferences={preferences.data}
      initialError={notifications.error || preferences.error ? 'Không thể tải trung tâm thông báo.' : undefined}
    />
  );
}
