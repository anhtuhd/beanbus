import Link from 'next/link';
import { Coffee, FileText, Inbox, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import AdminClient from './AdminClient';
import styles from './admin.module.css';
import { getAppMode } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';

export default async function AdminDashboardPage() {
  if (getAppMode() === 'demo') return <AdminClient />;

  await requireAdmin();

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
    </div>
  );
}
