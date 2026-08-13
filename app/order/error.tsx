'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import styles from './order.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function OrderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`wrap ${styles.loadingState}`}>
      <p className={styles.eyebrow}>Beanbus</p>
      <h1><LocalizedText vi="Không thể tải thực đơn" en="Unable to load the menu" /></h1>
      <p><LocalizedText vi="Vui lòng thử lại hoặc mở trang menu để xem các món đang phục vụ." en="Please try again or open the menu to view available items." /></p>
      <div className={styles.errorActions}>
        <button type="button" className="btn btn-primary" onClick={reset}><LocalizedText vi="Thử lại" en="Try again" /></button>
        <Link href="/menu" className="btn btn-dark"><LocalizedText vi="Mở menu" en="Open menu" /></Link>
      </div>
    </main>
  );
}
