'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { X, ShoppingBag, Plus, Minus, Trash2, Tag, ArrowRight } from 'lucide-react';
import styles from './CartDrawer.module.css';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    subtotal,
    discountAmount,
    finalTotal,
    appliedVoucher,
    applyVoucher,
    removeVoucher,
  } = useCart();
  const { t, lang } = useLanguage();
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherMsg, setVoucherMsg] = useState<{ success: boolean; text: string } | null>(null);

  if (!isCartOpen) return null;

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherInput.trim()) return;
    const res = applyVoucher(voucherInput);
    setVoucherMsg({ success: res.success, text: res.message });
    if (res.success) setVoucherInput('');
  };

  return (
    <div className={styles.overlay} onClick={() => setIsCartOpen(false)}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAWER HEADER */}
        <div className={styles.header}>
          <div className={styles.titleBox}>
            <ShoppingBag className={styles.icon} />
            <h3 id="cart-drawer-title">{t('Giỏ hàng của bạn', 'Your Shopping Cart')}</h3>
            <span className={styles.countBadge}>{cart.length}</span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={() => setIsCartOpen(false)}
            aria-label={t('Đóng giỏ hàng', 'Close cart')}
          >
            <X size={20} />
          </button>
        </div>

        {/* DRAWER BODY */}
        <div className={styles.body}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <ShoppingBag size={48} className={styles.emptyIcon} />
              <p>{t('Giỏ hàng đang trống', 'Your cart is currently empty')}</p>
              <Link
                href="/menu"
                className="btn btn-primary btn-sm"
                onClick={() => setIsCartOpen(false)}
              >
                {t('Khám phá Menu ngay', 'Explore Menu Now')}
              </Link>
            </div>
          ) : (
            <div className={styles.itemsList}>
              {cart.map((item) => (
                <div key={item.cartItemId} className={styles.cartItem}>
                  <img
                    src={item.product.image}
                    alt={lang === 'en' ? item.product.nameEn : item.product.nameVi}
                    className={styles.itemImg}
                  />
                  <div className={styles.itemDetails}>
                    <div className={styles.itemHeader}>
                      <h4 className={styles.itemName}>
                        {lang === 'en' ? item.product.nameEn : item.product.nameVi}
                      </h4>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeFromCart(item.cartItemId)}
                        aria-label={t(`Xóa ${item.product.nameVi}`, `Remove ${item.product.nameEn}`)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* OPTIONS DISPLAY */}
                    {item.selectedOptions.length > 0 && (
                      <div className={styles.optionsList}>
                        {item.selectedOptions.map((opt) => (
                          <span key={opt.id} className={styles.optionTag}>
                            + {lang === 'en' ? opt.nameEn : opt.nameVi}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.specialNote && (
                      <p className={styles.noteText}>📝 {item.specialNote}</p>
                    )}

                    <div className={styles.itemFooter}>
                      <div className={styles.qtyControl}>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          aria-label={t('Giảm số lượng', 'Decrease quantity')}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          aria-label={t('Tăng số lượng', 'Increase quantity')}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className={styles.itemPrice}>
                        {item.itemTotal.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DRAWER FOOTER */}
        {cart.length > 0 && (
          <div className={styles.footer}>
            {/* VOUCHER SECTION */}
            <div className={styles.voucherBox}>
              {appliedVoucher ? (
                <div className={styles.appliedVoucherTag}>
                  <div className={styles.vText}>
                    <Tag size={14} />
                    <span>
                      {appliedVoucher.code} (-
                      {appliedVoucher.discountType === 'percent'
                        ? `${appliedVoucher.discountValue}%`
                        : `${appliedVoucher.discountValue.toLocaleString('vi-VN')}đ`}
                      )
                    </span>
                  </div>
                  <button
                    onClick={removeVoucher}
                    className={styles.removeVoucherBtn}
                    aria-label={t('Gỡ mã giảm giá', 'Remove voucher')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyVoucher} className={styles.voucherForm}>
                  <input
                    type="text"
                    placeholder={t('Nhập mã voucher (BEANBUS10 / WELCOMEVIP)', 'Voucher code')}
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-dark btn-sm">
                    {t('Áp dụng', 'Apply')}
                  </button>
                </form>
              )}
              {voucherMsg && (
                <p
                  className={`${styles.vMsg} ${
                    voucherMsg.success ? styles.vMsgSuccess : styles.vMsgError
                  }`}
                >
                  {voucherMsg.text}
                </p>
              )}
            </div>

            {/* TOTALS */}
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>{t('Tạm tính:', 'Subtotal:')}</span>
                <span>{subtotal.toLocaleString('vi-VN')}đ</span>
              </div>
              {discountAmount > 0 && (
                <div className={`${styles.totalRow} ${styles.discountRow}`}>
                  <span>{t('Giảm giá:', 'Discount:')}</span>
                  <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className={`${styles.totalRow} ${styles.finalRow}`}>
                <span>{t('Tổng thanh toán:', 'Total:')}</span>
                <span className={styles.finalPrice}>
                  {finalTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* CHECKOUT BUTTON */}
            <Link
              href="/order/checkout"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setIsCartOpen(false)}
            >
              <span>{t('Tiến hành Thanh toán', 'Proceed to Checkout')}</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
