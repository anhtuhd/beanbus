import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Coffee, FileText, Inbox, ShieldCheck, ShoppingBag, Users, Coins, Ticket, Gift, Settings2 } from 'lucide-react';
import AdminClient from './AdminClient';
import styles from './admin.module.css';
import { getAppMode } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isStoredValueConfigured } from '@/lib/stored-value/config';

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
  const [orders, pendingOrders, pendingBookings, pendingLeads, members, failedBookings, failedLeads] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('customer_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('notification_status', 'failed'),
    supabase.from('customer_requests').select('id', { count: 'exact', head: true }).eq('notification_status', 'failed'),
  ]);
  const dataError = [orders, pendingOrders, pendingBookings, pendingLeads, members, failedBookings, failedLeads].some((result) => result.error);

  return (
    <div className={`wrap ${styles.adminPage}`}>
      <div className={styles.adminBanner}>
        <div className={styles.adminTitleBox}>
          <ShieldCheck size={32} className={styles.shieldIcon} />
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
          {storedValueConfigured && <Link href="/admin/stored-value" className="btn btn-dark btn-sm"><Coins size={16} /> Stored-value</Link>}
        </div>
      </div>
      {dataError && <p className={styles.dashboardNotice} role="alert">Không thể tải đầy đủ số liệu tổng quan.</p>}
      <div className={styles.kpiGrid}>
        <KpiCard label="Tổng đơn hàng" value={orders.count ?? 0} icon={<ShoppingBag size={22} />} href="/admin/orders" />
        <KpiCard label="Đơn chờ xử lý" value={pendingOrders.count ?? 0} icon={<CalendarClock size={22} />} href="/admin/orders?status=pending" />
        <KpiCard label="Yêu cầu chờ xử lý" value={(pendingBookings.count ?? 0) + (pendingLeads.count ?? 0)} icon={<Inbox size={22} />} href="/admin/requests?view=all&status=pending" />
        <KpiCard label="Hội viên" value={members.count ?? 0} icon={<Users size={22} />} href="/admin/members" />
        <KpiCard label="Thông báo lỗi" value={(failedBookings.count ?? 0) + (failedLeads.count ?? 0)} icon={<AlertTriangle size={22} />} href="/admin/requests?view=all&notification=failed" />
      </div>
    </div>
  );
}
