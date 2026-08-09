'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './cart.module.css';

const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')}d`;

export default function CartPage() {
  const { t, lang } = useLanguage();
  const { cart, cartCount, subtotal, discountAmount, finalTotal, appliedVoucher, applyVoucher, removeFromCart, removeVoucher, updateQuantity } = useCart();
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleVoucher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!voucherCode.trim()) return;
    const result = applyVoucher(voucherCode);
    setVoucherMessage({ success: result.success, text: result.message });
    if (result.success) setVoucherCode('');
  };

  if (cart.length === 0) {
    return (
      <main className={`wrap ${styles.emptyPage}`}>
        <ShoppingBag size={52} aria-hidden="true" />
        <h1>{t('Giỏ hàng đang trống', 'Your cart is empty')}</h1>
        <p>{t('Hãy chọn một ly cà phê hoặc bánh tươi để bắt đầu đơn hàng.', 'Choose a coffee or fresh pastry to start your order.')}</p>
        <Link href="/order" className="btn btn-primary"><span>{t('Chọn món', 'Browse menu')}</span><ArrowRight size={18} /></Link>
      </main>
    );
  }

  return (
    <main className={`wrap ${styles.page}`}>
      <div className={styles.pageHeader}>
        <div>
          <p>{t('Đặt trước - nhận tại quán', 'Order ahead - pick up in store')}</p>
          <h1>{t('Giỏ hàng của bạn', 'Your cart')}</h1>
        </div>
        <span>{cartCount} {t('món', 'items')}</span>
      </div>

      <div className={styles.layout}>
        <section className={styles.items} aria-label={t('Sản phẩm trong giỏ', 'Items in your cart')}>
          {cart.map((item) => (
            <article key={item.cartItemId} className={styles.item}>
              <Image
                src={item.product.image}
                alt={lang === 'en' ? item.product.nameEn : item.product.nameVi}
                width={112}
                height={112}
              />
              <div className={styles.itemInfo}>
                <div className={styles.itemTitle}>
                  <h2>{lang === 'en' ? item.product.nameEn : item.product.nameVi}</h2>
                  <button type="button" className={styles.removeButton} onClick={() => removeFromCart(item.cartItemId)} aria-label={t(`Xóa ${item.product.nameVi}`, `Remove ${item.product.nameEn}`)}>
                    <Trash2 size={17} />
                  </button>
                </div>
                {item.selectedOptions.length > 0 && <p className={styles.options}>{item.selectedOptions.map((option) => lang === 'en' ? option.nameEn : option.nameVi).join(' · ')}</p>}
                {item.specialNote && <p className={styles.note}>{t('Ghi chú:', 'Note:')} {item.specialNote}</p>}
                <div className={styles.itemFooter}>
                  <div className={styles.quantity} aria-label={t('Số lượng', 'Quantity')}>
                    <button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} aria-label={t('Giảm số lượng', 'Decrease quantity')}><Minus size={15} /></button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} aria-label={t('Tăng số lượng', 'Increase quantity')}><Plus size={15} /></button>
                  </div>
                  <strong>{formatVnd(item.itemTotal)}</strong>
                </div>
              </div>
            </article>
          ))}
          <Link href="/order" className={styles.continueLink}><ArrowLeft size={16} /> {t('Tiếp tục chọn món', 'Continue browsing')}</Link>
        </section>

        <aside className={styles.summary} aria-label={t('Tổng đơn hàng', 'Order total')}>
          <h2>{t('Tóm tắt đơn hàng', 'Order summary')}</h2>
          <form className={styles.voucher} onSubmit={handleVoucher}>
            {appliedVoucher ? (
              <div className={styles.appliedVoucher}>
                <span><Tag size={15} /> {appliedVoucher.code}</span>
                <button type="button" onClick={removeVoucher} aria-label={t('Gỡ mã giảm giá', 'Remove voucher')}><X size={16} /></button>
              </div>
            ) : (
              <>
                <label htmlFor="voucher-code">{t('Mã ưu đãi', 'Promo code')}</label>
                <div><input id="voucher-code" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} placeholder="BEANBUS10" /><button type="submit">{t('Áp dụng', 'Apply')}</button></div>
                {voucherMessage && <p className={voucherMessage.success ? styles.success : styles.error} role="status">{voucherMessage.text}</p>}
              </>
            )}
          </form>
          <div className={styles.totals}>
            <div><span>{t('Tạm tính', 'Subtotal')}</span><strong>{formatVnd(subtotal)}</strong></div>
            {discountAmount > 0 && <div className={styles.discount}><span>{t('Giảm giá', 'Discount')}</span><strong>-{formatVnd(discountAmount)}</strong></div>}
            <div className={styles.total}><span>{t('Tổng thanh toán', 'Total')}</span><strong>{formatVnd(finalTotal)}</strong></div>
          </div>
          <Link href="/order/checkout" className="btn btn-primary"><span>{t('Tiếp tục thanh toán', 'Continue to checkout')}</span><ArrowRight size={18} /></Link>
        </aside>
      </div>
    </main>
  );
}
