import { requireAdmin } from '@/lib/auth/session';
import { getAppMode } from '@/lib/env';
import { redirect } from 'next/navigation';
import SecurityForm from './SecurityForm';
import styles from '../admin.module.css';

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (getAppMode() === 'demo') redirect('/admin');
  await requireAdmin();
  const params = await searchParams;
  const recovery = params.recovery === '1';

  return (
    <main className={`wrap ${styles.adminPage}`}>
      <div className={styles.securityIntro}>
        <span className={styles.kpiLabel}>Tài khoản quản trị</span>
        <h1>Bảo mật tài khoản</h1>
        <p>Quản lý mật khẩu bằng Supabase Auth. Beanbus không lưu mật khẩu trong hồ sơ hội viên.</p>
      </div>
      <SecurityForm recovery={recovery} />
    </main>
  );
}
