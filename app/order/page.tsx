'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { ProductCustomizerModal } from '@/components/ui/ProductCustomizerModal';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { CATEGORIES, PRODUCTS, Product } from '@/data/products';
import styles from './order.module.css';

const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}d`;

export default function OrderPage() {
  const { t, lang } = useLanguage();
  const { cart, cartCount, finalTotal } = useCart();
  const [categoryId, setCategoryId] = useState('all');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const products = useMemo(
    () => PRODUCTS.filter((product) => product.isAvailable && (categoryId === 'all' || product.categoryId === categoryId)),
    [categoryId]
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="wrap">
          <div className={styles.eyebrow}>{t('Đặt trước - nhận tại quán', 'Order ahead - pick up in store')}</div>
          <h1>{t('Chọn món cho hôm nay', 'Choose your coffee for today')}</h1>
          <p>{t('Tuỳ chỉnh đồ uống, thêm vào giỏ và chọn thời gian nhận món ở bước thanh toán.', 'Customize your drink, add it to your cart, then choose a pickup time at checkout.')}</p>
        </div>
      </section>

      <main className={`wrap ${styles.content}`}>
        <div className={styles.mainColumn}>
          <div className={styles.toolbar}>
            <div>
              <span className={styles.toolbarLabel}><SlidersHorizontal size={16} /> {t('Danh mục', 'Category')}</span>
              <div className={styles.categories} role="group" aria-label={t('Danh mục sản phẩm', 'Product categories')}>
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={categoryId === category.id ? styles.categoryActive : styles.category}
                    onClick={() => setCategoryId(category.id)}
                    aria-pressed={categoryId === category.id}
                  >
                    {lang === 'en' ? category.nameEn : category.nameVi}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.productCount}>{t(`${products.length} món đang phục vụ`, `${products.length} items available`)}</p>
          </div>

          <div className={styles.productGrid}>
            {products.map((product, index) => (
              <article key={product.id} className={styles.productCard}>
                <Image
                  src={product.image}
                  alt={lang === 'en' ? product.nameEn : product.nameVi}
                  width={116}
                  height={116}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  className={styles.productImage}
                />
                <div className={styles.productBody}>
                  <div className={styles.productHeading}>
                    <h2>{lang === 'en' ? product.nameEn : product.nameVi}</h2>
                    {product.badge && <span className="badge badge-green">{product.badge}</span>}
                  </div>
                  <p>{lang === 'en' ? product.descriptionEn : product.descriptionVi}</p>
                  <div className={styles.productFooter}>
                    <strong>{formatVnd(product.price)}</strong>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveProduct(product)}>
                      {t('Tuỳ chọn', 'Customize')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className={styles.summary} aria-label={t('Tóm tắt giỏ hàng', 'Cart summary')}>
          <div className={styles.summaryHeader}>
            <ShoppingBag size={20} />
            <h2>{t('Giỏ hàng', 'Your cart')}</h2>
            <span>{cartCount}</span>
          </div>
          {cart.length === 0 ? (
            <p className={styles.emptyCart}>{t('Chưa có món nào trong giỏ.', 'Your cart is waiting for a drink.')}</p>
          ) : (
            <div className={styles.summaryItems}>
              {cart.slice(0, 3).map((item) => (
                <div key={item.cartItemId} className={styles.summaryItem}>
                  <span>{item.quantity}x</span>
                  <p>{lang === 'en' ? item.product.nameEn : item.product.nameVi}</p>
                  <strong>{formatVnd(item.itemTotal)}</strong>
                </div>
              ))}
              {cart.length > 3 && <p className={styles.moreItems}>{t(`và ${cart.length - 3} món khác`, `and ${cart.length - 3} more items`)}</p>}
            </div>
          )}
          <div className={styles.summaryFooter}>
            <div><span>{t('Tạm tính', 'Subtotal')}</span><strong>{formatVnd(finalTotal)}</strong></div>
            <Link href="/order/cart" className="btn btn-dark">
              <span>{t('Xem giỏ hàng', 'View cart')}</span><ChevronRight size={17} />
            </Link>
            {cart.length > 0 && (
              <Link href="/order/checkout" className="btn btn-primary">
                <span>{t('Thanh toán', 'Checkout')}</span><ArrowRight size={17} />
              </Link>
            )}
          </div>
        </aside>
      </main>

      {activeProduct && <ProductCustomizerModal product={activeProduct} onClose={() => setActiveProduct(null)} />}
    </div>
  );
}
