import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
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
            <p>Chưa có dữ liệu vận hành.</p>
          </div>
        </div>
        <Link href="/" className="btn btn-dark btn-sm">Về trang chủ</Link>
      </div>
    </div>
  );
}
