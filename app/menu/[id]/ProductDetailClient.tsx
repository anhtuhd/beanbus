'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Leaf, ShoppingBag, XCircle } from 'lucide-react';
import { ProductCustomizerModal } from '@/components/ui/ProductCustomizerModal';
import { useLanguage } from '@/context/LanguageContext';
import type { Category, Product } from '@/data/products';
import { isNextOptimizedImage } from '@/lib/media/image';
import styles from './product.module.css';

type ProductDetailClientProps = {
  category?: Category;
  product: Product;
};

export default function ProductDetailClient({ category, product }: ProductDetailClientProps) {
  const { lang, t } = useLanguage();
  const [customizing, setCustomizing] = useState(false);
  const name = lang === 'en' ? product.nameEn : product.nameVi;
  const description = lang === 'en' ? product.descriptionEn : product.descriptionVi;

  return (
    <div className={styles.productPage}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/menu" className={styles.backLink}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>{t('Quay lại thực đơn', 'Back to menu')}</span>
        </Link>

        <article className={styles.productLayout}>
          <div className={styles.media}>
            <Image
              src={product.image}
              alt={product.nameVi}
              fill
              unoptimized={!isNextOptimizedImage(product.image)}
              loading="eager"
              sizes="(max-width: 800px) 100vw, 52vw"
              className={styles.image}
            />
          </div>

          <div className={styles.content}>
            <div className={styles.metaRow}>
              {category && (
                <span className={styles.category}>
                  {lang === 'en' ? category.nameEn : category.nameVi}
                </span>
              )}
              {product.badge && <span className={styles.badge}>{product.badge}</span>}
            </div>

            <h1>{name}</h1>
            <p className={styles.secondaryName}>
              {lang === 'en' ? product.nameVi : product.nameEn}
            </p>
            <p className={styles.description}>{description}</p>

            {product.tastingNotes && (
              <div className={styles.notes}>
                <Leaf size={18} aria-hidden="true" />
                <span>{product.tastingNotes}</span>
              </div>
            )}

            <div className={styles.orderBox}>
              <div>
                <span className={styles.priceLabel}>{t('Giá từ', 'From')}</span>
                <strong className={styles.price}>{product.price.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className={product.isAvailable ? styles.available : styles.unavailable}>
                {product.isAvailable
                  ? <CheckCircle2 size={17} aria-hidden="true" />
                  : <XCircle size={17} aria-hidden="true" />}
                <span>{product.isAvailable ? t('Đang phục vụ', 'Available') : t('Tạm hết', 'Unavailable')}</span>
              </div>
            </div>

            <button
              className={`btn btn-primary btn-lg ${styles.orderButton}`}
              disabled={!product.isAvailable}
              onClick={() => setCustomizing(true)}
            >
              <ShoppingBag size={19} aria-hidden="true" />
              <span>{t('Chọn món', 'Customize')}</span>
            </button>
          </div>
        </article>
      </div>

      {customizing && (
        <ProductCustomizerModal product={product} onClose={() => setCustomizing(false)} />
      )}
    </div>
  );
}
