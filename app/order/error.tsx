'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import styles from './order.module.css';

export default function OrderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`wrap ${styles.loadingState}`}>
      <p className={styles.eyebrow}>Beanbus</p>
      <h1>Không thể tải thực đơn</h1>
      <p>Vui lòng thử lại hoặc mở trang menu để xem các món đang phục vụ.</p>
      <div className={styles.errorActions}>
        <button type="button" className="btn btn-primary" onClick={reset}>Thử lại</button>
        <Link href="/menu" className="btn btn-dark">Mở menu</Link>
      </div>
    </main>
  );
}
