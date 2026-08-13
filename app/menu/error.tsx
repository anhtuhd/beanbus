'use client';

import { RefreshCw } from 'lucide-react';
import styles from './page.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function MenuError({ reset }: { reset: () => void }) {
  return (
    <div className={`wrap ${styles.errorState}`}>
      <h1><LocalizedText vi="Không thể tải thực đơn" en="Unable to load the menu" /></h1>
      <p><LocalizedText vi="Vui lòng thử lại sau ít phút." en="Please try again in a few minutes." /></p>
      <button className="btn btn-primary" onClick={reset}>
        <RefreshCw size={16} aria-hidden="true" />
        <LocalizedText vi="Thử lại" en="Try again" />
      </button>
    </div>
  );
}
