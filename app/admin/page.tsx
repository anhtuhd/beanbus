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
import { LocalizedText } from '@/components/ui/LocalizedText';

function KpiCard({ labelVi, labelEn, value, icon, href }: { labelVi: string; labelEn: string; value: number; icon: ReactNode; href?: string }) {
  const content = (
      <div className={styles.kpiIcon}>{icon}</div>
  );
  const info = (
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}><LocalizedText vi={labelVi} en={labelEn} /></span>
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
            <p><LocalizedText vi="Quản lý dữ liệu production qua các luồng được phân quyền." en="Manage production data through permissioned workflows." /></p>
          </div>
        </div>
        <div className={styles.adminActions}>
          <Link href="/admin/orders" className="btn btn-primary btn-sm"><ShoppingBag size={16} /> <LocalizedText vi="Đơn hàng" en="Orders" /></Link>
          <Link href="/admin/requests" className="btn btn-dark btn-sm"><Inbox size={16} /> <LocalizedText vi="Yêu cầu" en="Requests" /></Link>
          <Link href="/admin/catalog" className="btn btn-dark btn-sm"><Coffee size={16} /> <LocalizedText vi="Catalog" en="Catalog" /></Link>
          <Link href="/admin/content" className="btn btn-dark btn-sm"><FileText size={16} /> <LocalizedText vi="Nội dung" en="Content" /></Link>
          <Link href="/admin/members" className="btn btn-dark btn-sm"><Users size={16} /> <LocalizedText vi="Hội viên" en="Members" /></Link>
          <Link href="/admin/loyalty" className="btn btn-dark btn-sm"><Coins size={16} /> <LocalizedText vi="Loyalty" en="Loyalty" /></Link>
          <Link href="/admin/vouchers" className="btn btn-dark btn-sm"><Ticket size={16} /> <LocalizedText vi="Voucher" en="Vouchers" /></Link>
          <Link href="/admin/rewards" className="btn btn-dark btn-sm"><Gift size={16} /> <LocalizedText vi="Phần thưởng" en="Rewards" /></Link>
          <Link href="/admin/policies" className="btn btn-dark btn-sm"><Settings2 size={16} /> <LocalizedText vi="Chính sách" en="Policies" /></Link>
          {notificationsEnabled && <Link href="/admin/notifications" className="btn btn-dark btn-sm"><Bell size={16} /> <LocalizedText vi="Thông báo" en="Notifications" /></Link>}
          {storedValueConfigured && <Link href="/admin/stored-value" className="btn btn-dark btn-sm"><Coins size={16} /> <LocalizedText vi="Gói nạp điểm" en="Stored value" /></Link>}
        </div>
      </div>
      {dataError && <p className={styles.dashboardNotice} role="alert"><LocalizedText vi="Không thể tải đầy đủ số liệu tổng quan." en="Some dashboard data could not be loaded." /></p>}
      <div className={styles.kpiGrid}>
        <KpiCard labelVi="Tổng đơn hàng" labelEn="Total orders" value={orders.count ?? 0} icon={<ShoppingBag size={22} />} href="/admin/orders" />
        <KpiCard labelVi="Đơn chờ xử lý" labelEn="Pending orders" value={pendingOrders.count ?? 0} icon={<CalendarClock size={22} />} href="/admin/orders?status=pending" />
        <KpiCard labelVi="Yêu cầu chờ xử lý" labelEn="Pending requests" value={(pendingBookings.count ?? 0) + (pendingLeads.count ?? 0)} icon={<Inbox size={22} />} href="/admin/requests?view=all&status=pending" />
        <KpiCard labelVi="Hội viên" labelEn="Members" value={members.count ?? 0} icon={<Users size={22} />} href="/admin/members" />
        {notificationsEnabled && <KpiCard labelVi="Thông báo chưa đọc" labelEn="Unread notifications" value={notificationStats?.unread_count ?? 0} icon={<Bell size={22} />} href="/admin/notifications" />}
        {notificationsEnabled && <KpiCard labelVi="Email gửi lỗi" labelEn="Failed emails" value={notificationStats?.failed_email_count ?? 0} icon={<AlertTriangle size={22} />} href="/admin/notifications" />}
      </div>
    </div>
  );
}
