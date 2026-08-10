'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { Category, Product } from '@/data/products';
import { ProductCustomizerModal } from '@/components/ui/ProductCustomizerModal';
import { Search, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import styles from './page.module.css';

type MenuClientProps = {
  categories: Category[];
  products: Product[];
};

export default function MenuClient({ categories, products }: MenuClientProps) {
  const { t, lang } = useLanguage();
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  let filtered = products.filter((product) => {
    const matchesCategory = selectedCat === 'all' || product.categoryId === selectedCat;
    const searchable = `${product.nameVi} ${product.nameEn} ${product.tastingNotes ?? ''}`.toLowerCase();
    return matchesCategory && searchable.includes(searchQuery.toLowerCase());
  });

  if (sortBy === 'price-asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sortBy === 'price-desc') filtered = [...filtered].sort((a, b) => b.price - a.price);

  return (
    <div className={styles.menuPage}>
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Thực đơn Beanbus', 'Beanbus Menu')}</span>
          </div>
          <h1 className={styles.title}>
            {t('Menu Đồ Uống & Bánh Tươi', 'Café Drinks & Pastry Menu')}
          </h1>
          <p className={styles.subTitle}>
            {t(
              'Tất cả đồ uống đều được pha chế chắt lọc từ hạt cà phê rang tươi mỗi ngày tại xưởng Beanbus Hải Phòng.',
              'All specialty drinks brewed fresh daily from freshly roasted beans at Beanbus Hai Phong.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="search"
              aria-label={t('Tìm trong thực đơn', 'Search menu')}
              placeholder={t('Tìm tên đồ uống, vị cà phê...', 'Search drink, flavor notes...')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className={styles.sortBox}>
            <SlidersHorizontal size={16} className={styles.sortIcon} />
            <select
              aria-label={t('Sắp xếp thực đơn', 'Sort menu')}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            >
              <option value="default">{t('Sắp xếp: Mặc định', 'Sort: Default')}</option>
              <option value="price-asc">{t('Giá: Thấp đến Cao', 'Price: Low to High')}</option>
              <option value="price-desc">{t('Giá: Cao đến Thấp', 'Price: High to Low')}</option>
            </select>
          </div>
        </div>

        <div className={styles.categoryTabs} aria-label={t('Danh mục', 'Categories')}>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`${styles.tabBtn} ${selectedCat === category.id ? styles.tabActive : ''}`}
              onClick={() => setSelectedCat(category.id)}
            >
              {lang === 'en' ? category.nameEn : category.nameVi}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} className={styles.emptyIcon} />
            <h3>{t('Không tìm thấy sản phẩm phù hợp', 'No products found')}</h3>
            <p>{t('Hãy thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.', 'Try searching another keyword or change category.')}</p>
          </div>
        ) : (
          <div className={styles.productsGrid}>
            {filtered.map((product, index) => (
              <article key={product.id} className={styles.productCard}>
                {product.badge && (
                  <span className={styles.badge}>
                    {product.badge === 'best'
                      ? 'Best Seller'
                      : product.badge === 'signature'
                        ? 'Signature'
                        : product.badge === 'seasonal'
                          ? 'Seasonal'
                          : 'New'}
                  </span>
                )}
                <Link href={`/menu/${product.id}`} className={styles.imgWrapper}>
                  <Image
                    src={product.image}
                    alt={lang === 'en' ? product.nameEn : product.nameVi}
                    width={640}
                    height={440}
                    unoptimized
                    loading={index === 0 ? 'eager' : 'lazy'}
                    sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    className={styles.productImg}
                  />
                </Link>
                <div className={styles.cardBody}>
                  <h2 className={styles.productName}>
                    <Link href={`/menu/${product.id}`}>
                      {lang === 'en' ? product.nameEn : product.nameVi}
                    </Link>
                  </h2>
                  <p className={styles.productDesc}>
                    {lang === 'en' ? product.descriptionEn : product.descriptionVi}
                  </p>
                  {product.tastingNotes && (
                    <div className={styles.tastingNotes}>
                      <span>{product.tastingNotes}</span>
                    </div>
                  )}
                  <div className={styles.cardFooter}>
                    <div className={styles.price}>{product.price.toLocaleString('vi-VN')}đ</div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!product.isAvailable}
                      onClick={() => setActiveProduct(product)}
                    >
                      {product.isAvailable ? t('Chọn món', 'Add') : t('Tạm hết', 'Unavailable')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {activeProduct && (
        <ProductCustomizerModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
    </div>
  );
}
