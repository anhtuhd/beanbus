import { redirect } from 'next/navigation';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getGuestNotificationSessionId } from '@/lib/notifications/guest-session';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true') redirect('/order');
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) redirect('/notifications');
  const sessionId = await getGuestNotificationSessionId();
  if (!sessionId) redirect('/notifications');

  const admin = createAdminSupabaseClient();
  const { data: access } = await admin.from('guest_order_access')
    .select('order_id')
    .eq('guest_session_id', sessionId)
    .eq('order_id', id)
    .maybeSingle();
  if (!access) redirect('/notifications');
  const { data: order } = await admin.from('orders').select('receipt_token').eq('id', id).maybeSingle();
  if (!order?.receipt_token) redirect('/notifications');
  redirect(`/order/confirmation/${id}?receipt=${encodeURIComponent(order.receipt_token)}`);
}
