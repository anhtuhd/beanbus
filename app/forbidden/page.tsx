import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import styles from '@/app/account/account.module.css';

export default function ForbiddenPage() {
  return (
    <div className={`wrap ${styles.loginPage}`}>
      <div className={styles.loginCard}>
        <div className={styles.logoHeader}>
          <LockKeyhole size={36} className={styles.goldIcon} />
          <h1>Không có quyền truy cập</h1>
          <p>Tài khoản này không có quyền mở khu vực quản trị.</p>
        </div>
        <Link href="/account" className={`btn btn-dark ${styles.fullButton}`}>
          Về tài khoản
        </Link>
      </div>
    </div>
  );
}
