import Link from 'next/link';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import styles from './confirmation.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function OrderNotFound() {
  return (
    <div className={`wrap ${styles.notFound}`}>
      <ReceiptText size={44} aria-hidden="true" />
      <h1>Không tìm thấy đơn hàng</h1>
      <p>Liên kết xác nhận không hợp lệ hoặc đã bị thay đổi.</p>
      <Link href="/menu" className="btn btn-primary">
        <ArrowLeft size={17} aria-hidden="true" />
        <LocalizedText vi="Về thực đơn" en="Back to menu" />
      </Link>
    </div>
  );
}
