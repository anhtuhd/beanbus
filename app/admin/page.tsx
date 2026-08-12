import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { AlertTriangle, Bell, CalendarClock, Coffee, FileText, Inbox, ShoppingBag, Users, Coins, Ticket, Gift, Settings2 } from 'lucide-react';
import AdminClient from './AdminClient';
import styles from './admin.module.css';
import { getAppMode, isNotificationsEnabled } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isStoredValueConfigured } from '@/lib/stored-value/config';
import { BRAND_ASSETS } from '@/lib/brand/assets';

function KpiCard({ label, value, icon, href }: { label: string; value: number; icon: ReactNode; href?: string }) {
  const content = (
      <div className={styles.kpiIcon}>{icon}</div>
  );
  const info = (
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value.toLocaleString('vi-VN')}</span>
      </div>
  );
  if (href) return <Link href={href} className={styles.kpiCard}>{content}{info}</Link>;
  return <div className={styles.kpiCard}>{content}{info}</div>;
}

export default async function AdminDashboardPage() {
  if (getAppMode() === 'demo') return <AdminClient />;

  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const storedValueConfigured = isStoredValueConfigured();
  const notificationsEnabled = isNotificationsEnabled();
  const [orders, pendingOrders, pendingBookings, pendingLeads, members, notificationSummary] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('customer_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    notificationsEnabled
      ? supabase.rpc('get_admin_notification_summary')
      : Promise.resolve({ data: null, error: null }),
  ]);
  const dataError = [orders, pendingOrders, pendingBookings, pendingLeads, members, notificationSummary].some((result) => result.error);
  const notificationStats = notificationSummary.data?.[0];

  return (
    <div className={`wrap ${styles.adminPage}`}>
      <div className={styles.adminBanner}>
        <div className={styles.adminTitleBox}>
          <Image
            src={BRAND_ASSETS.logoLight}
            alt="Beanbus Coffee Roaster"
            width={180}
            height={34}
            className={styles.adminLogo}
          />
          <div>
            <h1>Beanbus Operations</h1>
            <p>Quản lý dữ liệu production qua các luồng được phân quyền.</p>
          </div>
        </div>
        <div className={styles.adminActions}>
          <Link href="/admin/orders" className="btn btn-primary btn-sm"><ShoppingBag size={16} /> Orders</Link>
          <Link href="/admin/requests" className="btn btn-dark btn-sm"><Inbox size={16} /> Booking & Requests</Link>
          <Link href="/admin/catalog" className="btn btn-dark btn-sm"><Coffee size={16} /> Catalog</Link>
          <Link href="/admin/content" className="btn btn-dark btn-sm"><FileText size={16} /> Events & Blog</Link>
          <Link href="/admin/members" className="btn btn-dark btn-sm"><Users size={16} /> Members</Link>
          <Link href="/admin/loyalty" className="btn btn-dark btn-sm"><Coins size={16} /> Loyalty</Link>
          <Link href="/admin/vouchers" className="btn btn-dark btn-sm"><Ticket size={16} /> Vouchers</Link>
          <Link href="/admin/rewards" className="btn btn-dark btn-sm"><Gift size={16} /> Rewards</Link>
          <Link href="/admin/policies" className="btn btn-dark btn-sm"><Settings2 size={16} /> Chính sách</Link>
          {notificationsEnabled && <Link href="/admin/notifications" className="btn btn-dark btn-sm"><Bell size={16} /> Thông báo</Link>}
          {storedValueConfigured && <Link href="/admin/stored-value" className="btn btn-dark btn-sm"><Coins size={16} /> Stored-value</Link>}
        </div>
      </div>
      {dataError && <p className={styles.dashboardNotice} role="alert">Không thể tải đầy đủ số liệu tổng quan.</p>}
      <div className={styles.kpiGrid}>
        <KpiCard label="Tổng đơn hàng" value={orders.count ?? 0} icon={<ShoppingBag size={22} />} href="/admin/orders" />
        <KpiCard label="Đơn chờ xử lý" value={pendingOrders.count ?? 0} icon={<CalendarClock size={22} />} href="/admin/orders?status=pending" />
        <KpiCard label="Yêu cầu chờ xử lý" value={(pendingBookings.count ?? 0) + (pendingLeads.count ?? 0)} icon={<Inbox size={22} />} href="/admin/requests?view=all&status=pending" />
        <KpiCard label="Hội viên" value={members.count ?? 0} icon={<Users size={22} />} href="/admin/members" />
        {notificationsEnabled && <KpiCard label="Thông báo chưa đọc" value={notificationStats?.unread_count ?? 0} icon={<Bell size={22} />} href="/admin/notifications" />}
        {notificationsEnabled && <KpiCard label="Email gửi lỗi" value={notificationStats?.failed_email_count ?? 0} icon={<AlertTriangle size={22} />} href="/admin/notifications" />}
      </div>
    </div>
  );
}
