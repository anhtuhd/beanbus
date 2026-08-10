import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarClock, Coffee, FileText, Inbox, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import AdminClient from './AdminClient';
import styles from './admin.module.css';
import { getAppMode } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function KpiCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value.toLocaleString('vi-VN')}</span>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  if (getAppMode() === 'demo') return <AdminClient />;

  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const [orders, pendingOrders, pendingBookings, pendingLeads, members] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('customer_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);
  const dataError = [orders, pendingOrders, pendingBookings, pendingLeads, members].some((result) => result.error);

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
        </div>
      </div>
      {dataError && <p className={styles.dashboardNotice} role="alert">Không thể tải đầy đủ số liệu tổng quan.</p>}
      <div className={styles.kpiGrid}>
        <KpiCard label="Tổng đơn hàng" value={orders.count ?? 0} icon={<ShoppingBag size={22} />} />
        <KpiCard label="Đơn chờ xử lý" value={pendingOrders.count ?? 0} icon={<CalendarClock size={22} />} />
        <KpiCard label="Yêu cầu chờ xử lý" value={(pendingBookings.count ?? 0) + (pendingLeads.count ?? 0)} icon={<Inbox size={22} />} />
        <KpiCard label="Hội viên" value={members.count ?? 0} icon={<Users size={22} />} />
      </div>
    </div>
  );
}
