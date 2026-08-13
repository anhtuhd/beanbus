'use client';

import Link from 'next/link';
import { CircleAlert, RefreshCw } from 'lucide-react';
import styles from './account.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={`wrap ${styles.accountPage}`}>
      <div className={styles.accountStatus} role="alert" aria-live="assertive">
        <CircleAlert size={18} aria-hidden="true" />
        <span><LocalizedText vi="Không thể tải dữ liệu hội viên lúc này." en="Member data is unavailable right now." /></span>
      </div>
      <div className={styles.errorActions}>
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" /> <LocalizedText vi="Thử lại" en="Try again" />
        </button>
        <Link href="/" className="btn btn-dark btn-sm"><LocalizedText vi="Về trang chủ" en="Back home" /></Link>
      </div>
    </main>
  );
}
