'use client';

import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import styles from './page.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={`wrap ${styles.routeState}`}>
      <p className="eyebrow">Beanbus</p>
      <h1><LocalizedText vi="Không thể tải trang chủ" en="Unable to load the home page" /></h1>
      <p role="alert" aria-live="assertive">
        <LocalizedText vi="Dữ liệu cửa hàng đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút." en="Store data is temporarily unavailable. Please try again in a few minutes." />
      </p>
      <div className="errorActions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" />
          <LocalizedText vi="Thử lại" en="Try again" />
        </button>
        <Link href="/menu" className="btn btn-dark">
          <ArrowRight size={16} aria-hidden="true" />
          <LocalizedText vi="Mở menu" en="Open menu" />
        </Link>
      </div>
    </main>
  );
}
