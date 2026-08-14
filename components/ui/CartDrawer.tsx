'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import { X, ShoppingBag, Plus, Minus, Trash2, Tag, ArrowRight } from 'lucide-react';
import styles from './CartDrawer.module.css';
import { isNextOptimizedImage } from '@/lib/media/image';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';
const pointsPaymentFlag = process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT === 'true';

type PointsState = {
  enabled: boolean;
  availablePoints: number;
  loading: boolean;
};

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
    usePoints,
    setUsePoints,
    appliedVoucher,
    applyVoucher,
    removeVoucher,
  } = useCart();
  const { t, lang } = useLanguage();
  const { user, isAuthReady } = useAuth();
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherMsg, setVoucherMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [pointsState, setPointsState] = useState<PointsState | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(isCartOpen, () => setIsCartOpen(false));

  /* eslint-disable react-hooks/set-state-in-effect -- The balance is loaded only while the cart drawer is open. */
  useEffect(() => {
    if (!isCartOpen || cart.length === 0) return;

    if (!isAuthReady) {
      setPointsState(null);
      setUsePoints(false);
      return;
    }

    if (
      !isProduction ||
      !pointsPaymentFlag ||
      !user ||
      user.role !== 'member'
    ) {
      setPointsState(null);
      setUsePoints(false);
      return;
    }

    const controller = new AbortController();
    setPointsState({ enabled: false, availablePoints: 0, loading: true });

    fetch('/api/account/points', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('POINTS_REQUEST_FAILED');
        return response.json() as Promise<{ enabled?: boolean; availablePoints?: number }>;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        const availablePoints = Math.max(0, Number(result.availablePoints ?? 0));
        setPointsState({
          enabled: result.enabled === true,
          availablePoints,
          loading: false,
        });
        if (result.enabled !== true || availablePoints <= 0) setUsePoints(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPointsState({ enabled: false, availablePoints: 0, loading: false });
        setUsePoints(false);
      });

    return () => controller.abort();
  }, [cart.length, isAuthReady, isCartOpen, setUsePoints, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isCartOpen) return null;

  const pointsAvailable = Math.max(0, pointsState?.availablePoints ?? 0);
  const pointsPaymentAvailable = Boolean(
    isAuthReady &&
    user?.role === 'member' &&
    pointsState?.enabled &&
    pointsAvailable > 0 &&
    finalTotal > 0,
  );
  const pointsApplied = pointsPaymentAvailable && usePoints
    ? Math.min(pointsAvailable, finalTotal)
    : 0;
  const cashDue = Math.max(0, finalTotal - pointsApplied);

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
        ref={dialogRef}
        className={styles.drawer}
        tabIndex={-1}
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
                  <Image
                    src={item.product.image}
                    alt={lang === 'en' ? item.product.nameEn : item.product.nameVi}
                    width={72}
                    height={72}
                    unoptimized={!isNextOptimizedImage(item.product.image)}
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
                    aria-label={t('Mã giảm giá', 'Voucher code')}
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
                  role="status"
                  className={`${styles.vMsg} ${
                    voucherMsg.success ? styles.vMsgSuccess : styles.vMsgError
                  }`}
                >
                  {voucherMsg.text}
                </p>
              )}
            </div>

            {/* TOTALS */}
            {(pointsState?.loading || pointsPaymentAvailable) && (
              <div className={styles.pointsBox}>
                <div className={styles.pointsMeta}>
                  <div className={styles.pointsLabel}>
                    <Tag size={16} />
                    <span>{t('Điểm khả dụng', 'Available points')}</span>
                  </div>
                  {pointsState?.loading ? (
                    <strong className={styles.pointsBalance}>{t('Đang tải...', 'Loading...')}</strong>
                  ) : (
                    <>
                      <strong className={styles.pointsBalance}>
                        {pointsAvailable.toLocaleString('vi-VN')} {t('điểm', 'points')}
                      </strong>
                      <span className={styles.pointsHint}>
                        {t('1 điểm = 1đ', '1 point = 1đ')}
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={usePoints}
                  aria-label={t('Dùng điểm khi thanh toán', 'Use points at checkout')}
                  className={`${styles.pointsSwitch} ${usePoints ? styles.pointsSwitchOn : ''}`}
                  disabled={!pointsPaymentAvailable || pointsState?.loading === true}
                  onClick={() => setUsePoints(!usePoints)}
                >
                  <span className={styles.pointsSwitchTrack} aria-hidden="true">
                    <span className={styles.pointsSwitchThumb} />
                  </span>
                  <span>{usePoints ? t('BẬT', 'ON') : t('TẮT', 'OFF')}</span>
                </button>
              </div>
            )}
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
              {pointsApplied > 0 && (
                <div className={`${styles.totalRow} ${styles.pointsRow}`}>
                  <span>{t('Điểm sử dụng:', 'Points used:')}</span>
                  <span>-{pointsApplied.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className={`${styles.totalRow} ${styles.finalRow}`}>
                <span>{pointsApplied > 0 ? t('Còn thanh toán:', 'Remaining:') : t('Tổng thanh toán:', 'Total:')}</span>
                <span className={styles.finalPrice}>
                  {cashDue.toLocaleString('vi-VN')}đ
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
