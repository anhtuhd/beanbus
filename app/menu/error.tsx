'use client';

import { RefreshCw } from 'lucide-react';
import styles from './page.module.css';

export default function MenuError({ reset }: { reset: () => void }) {
  return (
    <div className={`wrap ${styles.errorState}`}>
      <h1>Không thể tải thực đơn</h1>
      <p>Vui lòng thử lại sau ít phút.</p>
      <button className="btn btn-primary" onClick={reset}>
        <RefreshCw size={16} aria-hidden="true" />
        <span>Thử lại</span>
      </button>
    </div>
  );
}
