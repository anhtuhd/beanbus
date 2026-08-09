'use client';

import React, { useState } from 'react';
import { Product, ProductOption } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { X, Plus, Minus } from 'lucide-react';
import styles from './ProductCustomizerModal.module.css';

interface Props {
  product: Product;
  onClose: () => void;
}

export const ProductCustomizerModal: React.FC<Props> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const { t, lang } = useLanguage();

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>(() => {
    // Default select Size M (first size)
    const defaultSize = product.options?.find((o) => o.group === 'size' && o.id.includes('m'));
    return defaultSize ? [defaultSize] : [];
  });
  const [specialNote, setSpecialNote] = useState('');

  const handleToggleOption = (option: ProductOption) => {
    if (option.group === 'size' || option.group === 'sugar' || option.group === 'ice') {
      // Single select within group
      setSelectedOptions((prev) => [
        ...prev.filter((o) => o.group !== option.group),
        option,
      ]);
    } else {
      // Multi-select for toppings
      setSelectedOptions((prev) =>
        prev.some((o) => o.id === option.id)
          ? prev.filter((o) => o.id !== option.id)
          : [...prev, option]
      );
    }
  };

  const extraTotal = selectedOptions.reduce((sum, opt) => sum + opt.extraPrice, 0);
  const unitPrice = product.price + extraTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedOptions, specialNote);
    onClose();
  };

  // Group options by type
  const sizes = product.options?.filter((o) => o.group === 'size') || [];
  const sugars = product.options?.filter((o) => o.group === 'sugar') || [];
  const ices = product.options?.filter((o) => o.group === 'ice') || [];
  const toppings = product.options?.filter((o) => o.group === 'topping') || [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <h3 className={styles.title}>
            {lang === 'en' ? product.nameEn : product.nameVi}
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          {/* PRODUCT BANNER */}
          <div className={styles.productBanner}>
            <img src={product.image} alt={product.nameVi} className={styles.image} />
            <div className={styles.bannerInfo}>
              <p className={styles.desc}>
                {lang === 'en' ? product.descriptionEn : product.descriptionVi}
              </p>
              {product.tastingNotes && (
                <div className={styles.notes}>
                  📍 <strong>Tasting Notes:</strong> {product.tastingNotes}
                </div>
              )}
              <div className={styles.basePrice}>
                {product.price.toLocaleString('vi-VN')}đ
              </div>
            </div>
          </div>

          {/* OPTIONS SECTIONS */}
          {sizes.length > 0 && (
            <div className={styles.optionSection}>
              <h4>{t('Chọn Size', 'Select Size')}</h4>
              <div className={styles.optionsGrid}>
                {sizes.map((opt) => {
                  const isSelected = selectedOptions.some((o) => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      className={`${styles.optCard} ${isSelected ? styles.optSelected : ''}`}
                      onClick={() => handleToggleOption(opt)}
                    >
                      <span>{lang === 'en' ? opt.nameEn : opt.nameVi}</span>
                      {opt.extraPrice > 0 && (
                        <span className={styles.extraPrice}>
                          +{opt.extraPrice.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sugars.length > 0 && (
            <div className={styles.optionSection}>
              <h4>{t('Lượng Đường', 'Sugar Level')}</h4>
              <div className={styles.optionsGrid}>
                {sugars.map((opt) => {
                  const isSelected = selectedOptions.some((o) => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      className={`${styles.optCard} ${isSelected ? styles.optSelected : ''}`}
                      onClick={() => handleToggleOption(opt)}
                    >
                      <span>{lang === 'en' ? opt.nameEn : opt.nameVi}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {ices.length > 0 && (
            <div className={styles.optionSection}>
              <h4>{t('Lượng Đá', 'Ice Level')}</h4>
              <div className={styles.optionsGrid}>
                {ices.map((opt) => {
                  const isSelected = selectedOptions.some((o) => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      className={`${styles.optCard} ${isSelected ? styles.optSelected : ''}`}
                      onClick={() => handleToggleOption(opt)}
                    >
                      <span>{lang === 'en' ? opt.nameEn : opt.nameVi}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {toppings.length > 0 && (
            <div className={styles.optionSection}>
              <h4>{t('Thêm Topping', 'Extra Toppings')}</h4>
              <div className={styles.optionsGrid}>
                {toppings.map((opt) => {
                  const isSelected = selectedOptions.some((o) => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      className={`${styles.optCard} ${isSelected ? styles.optSelected : ''}`}
                      onClick={() => handleToggleOption(opt)}
                    >
                      <span>{lang === 'en' ? opt.nameEn : opt.nameVi}</span>
                      <span className={styles.extraPrice}>
                        +{opt.extraPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SPECIAL NOTE */}
          <div className={styles.optionSection}>
            <h4>{t('Ghi chú đặc biệt', 'Special Instructions')}</h4>
            <input
              type="text"
              placeholder={t('Ví dụ: Ít ngọt, pha ít sữa...', 'e.g. Less sweet, extra hot...')}
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              className={styles.noteInput}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <div className={styles.qtyControl}>
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
              <Minus size={16} />
            </button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)}>
              <Plus size={16} />
            </button>
          </div>

          <button className="btn btn-primary btn-lg" onClick={handleAddToCart}>
            <span>
              {t('Thêm vào giỏ', 'Add to Cart')} • {totalPrice.toLocaleString('vi-VN')}đ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
