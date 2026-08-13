import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuestNotificationCenter from '@/components/notifications/GuestNotificationCenter';

export const metadata: Metadata = {
  title: 'Thông báo đơn hàng | Beanbus',
  robots: { index: false, follow: false },
};

export default function GuestNotificationsPage() {
  if (
    process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS !== 'true'
  ) notFound();
  return <GuestNotificationCenter />;
}
