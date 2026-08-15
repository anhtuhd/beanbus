import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { requireOperator } from '@/lib/auth/session';
import styles from '../admin/requests/requests.module.css';

export default async function PosPage() {
  await requireOperator();
  const enabled = process.env.ENABLE_POS_STAFF === 'true';
  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div><span className={styles.backLink}><Store size={16} /> Beanbus POS</span><h1>Quầy bán hàng</h1><p>Tìm hội viên, áp dụng quyền lợi và tạo đơn tại quầy.</p></div>
        <Link href="/pos/new" className="btn btn-primary"><ArrowRight size={16} /> Tạo đơn</Link>
      </header>
      {!enabled && <div className={styles.stateBox} role="status">POS đang tạm tắt. Bật ENABLE_POS_STAFF sau khi đã kiểm thử quyền staff.</div>}
    </main>
  );
}
