'use client';

import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import styles from './page.module.css';

export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={`wrap ${styles.routeState}`}>
      <p className="eyebrow">Beanbus</p>
      <h1>Không thể tải trang chủ</h1>
      <p role="alert" aria-live="assertive">
        Dữ liệu cửa hàng đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút.
      </p>
      <div className="errorActions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </button>
        <Link href="/menu" className="btn btn-dark">
          <ArrowRight size={16} aria-hidden="true" />
          Mở menu
        </Link>
      </div>
    </main>
  );
}
