import Link from 'next/link';
import { PRODUCTS } from '@/data/products';
import { getAppMode } from '@/lib/env';
import styles from './order.module.css';

export default function OrderLoading() {
  const products = getAppMode() === 'demo' ? PRODUCTS : [];
  return (
    <div className={styles.noScriptFallback} aria-busy="true">
      <div className="wrap">
        <p className={styles.eyebrow}>Beanbus</p>
        <h1>Đang tải thực đơn...</h1>
        <p>JavaScript đang tắt hoặc thực đơn đang được chuẩn bị.</p>
        {products.length > 0 ? <div className={styles.noScriptList}>
          {products.map((product) => (
            <article key={product.id} className={styles.noScriptItem}>
              <Link href={`/menu/${product.id}`}>
                <strong>{product.nameVi}</strong>
                <span>{product.descriptionVi}</span>
                <b>{product.price.toLocaleString('vi-VN')}đ</b>
              </Link>
            </article>
          ))}
        </div> : <p>Đang tải dữ liệu thực đơn. <Link href="/contact">Liên hệ Beanbus</Link> để được hỗ trợ.</p>}
      </div>
    </div>
  );
}
