'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { PRODUCTS, CATEGORIES, Product } from '@/data/products';
import { ProductCustomizerModal } from '@/components/ui/ProductCustomizerModal';
import { Search, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import styles from './page.module.css';

export default function MenuPage() {
  const { t, lang } = useLanguage();
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Filter products
  let filtered = PRODUCTS.filter((p) => {
    const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const nameStr = (p.nameVi + ' ' + p.nameEn + ' ' + (p.tastingNotes || '')).toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Sort products
  if (sortBy === 'price-asc') {
    filtered = [...filtered].sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    filtered = [...filtered].sort((a, b) => b.price - a.price);
  }

  return (
    <div className={styles.menuPage}>
      {/* HEADER BANNER */}
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
        {/* CONTROLS BAR: SEARCH & SORT */}
        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('Tìm tên đồ uống, vị cà phê...', 'Search drink, flavor notes...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.sortBox}>
            <SlidersHorizontal size={16} className={styles.sortIcon} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="default">{t('Sắp xếp: Mặc định', 'Sort: Default')}</option>
              <option value="price-asc">{t('Giá: Thấp đến Cao', 'Price: Low to High')}</option>
              <option value="price-desc">{t('Giá: Cao đến Thấp', 'Price: High to Low')}</option>
            </select>
          </div>
        </div>

        {/* CATEGORY TABS */}
        <div className={styles.categoryTabs}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.tabBtn} ${selectedCat === cat.id ? styles.tabActive : ''}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              {lang === 'en' ? cat.nameEn : cat.nameVi}
            </button>
          ))}
        </div>

        {/* PRODUCTS GRID */}
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} className={styles.emptyIcon} />
            <h3>{t('Không tìm thấy sản phẩm phù hợp', 'No products found')}</h3>
            <p>{t('Hãy thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.', 'Try searching another keyword or change category.')}</p>
          </div>
        ) : (
          <div className={styles.productsGrid}>
            {filtered.map((item) => (
              <div key={item.id} className={styles.productCard}>
                {item.badge && (
                  <span className={styles.badge}>
                    {item.badge === 'best'
                      ? 'Best Seller'
                      : item.badge === 'signature'
                      ? 'Signature'
                      : item.badge === 'seasonal'
                      ? 'Seasonal'
                      : 'New'}
                  </span>
                )}
                <div className={styles.imgWrapper}>
                  <img src={item.image} alt={item.nameVi} className={styles.productImg} />
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.productName}>
                    {lang === 'en' ? item.nameEn : item.nameVi}
                  </h3>
                  <p className={styles.productDesc}>
                    {lang === 'en' ? item.descriptionEn : item.descriptionVi}
                  </p>
                  {item.tastingNotes && (
                    <div className={styles.tastingNotes}>
                      🌱 <span>{item.tastingNotes}</span>
                    </div>
                  )}
                  <div className={styles.cardFooter}>
                    <div className={styles.price}>
                      {item.price.toLocaleString('vi-VN')}đ
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setActiveProduct(item)}
                    >
                      {t('+ Chọn món', '+ Add')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CUSTOMIZER MODAL */}
      {activeProduct && (
        <ProductCustomizerModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
    </div>
  );
}
