import Link from 'next/link';
import Image from 'next/image';
import { LockKeyhole } from 'lucide-react';
import styles from '@/app/account/account.module.css';
import { BRAND_ASSETS } from '@/lib/brand/assets';

export default function ForbiddenPage() {
  return (
    <div className={`wrap ${styles.loginPage}`}>
      <div className={styles.loginCard}>
        <div className={styles.logoHeader}>
          <Image
            src={BRAND_ASSETS.logoDark}
            alt="Beanbus Coffee Roaster"
            width={220}
            height={42}
            className={styles.authLogo}
          />
          <LockKeyhole size={28} className={styles.goldIcon} />
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
