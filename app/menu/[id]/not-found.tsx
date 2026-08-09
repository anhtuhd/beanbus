import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './product.module.css';

export default function ProductNotFound() {
  return (
    <div className={`wrap ${styles.notFound}`}>
      <h1>Không tìm thấy món</h1>
      <p>Sản phẩm không tồn tại hoặc chưa được phục vụ.</p>
      <Link href="/menu" className="btn btn-primary">
        <ArrowLeft size={17} aria-hidden="true" />
        <span>Về thực đơn</span>
      </Link>
    </div>
  );
}
