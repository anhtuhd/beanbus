'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useOrders, PaymentMethod, OrderType } from '@/context/OrderContext';
import { useAuth } from '@/context/AuthContext';
import { SepayQRModal } from '@/components/ui/SepayQRModal';
import { ShoppingBag, Clock, MapPin, QrCode, DollarSign, ShieldCheck, Tag } from 'lucide-react';
import styles from './checkout.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, discountAmount, finalTotal, appliedVoucher } = useCart();
  const { t, lang } = useLanguage();
  const { createOrder } = useOrders();
  const { user, addPoints } = useAuth();

  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [pickupTime, setPickupTime] = useState('2026-08-09T11:30');
  const [deliveryAddress, setDeliveryAddress] = useState('Số 25 Thanh Bình, Phường Lê Thanh Nghị, Hải Phòng');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepay_qr');

  // Sepay Modal State
  const [sepayModal, setSepayModal] = useState<{
    isOpen: boolean;
    orderId: string;
    sepayCode: string;
  }>({
    isOpen: false,
    orderId: '',
    sepayCode: '',
  });

  if (cart.length === 0) {
    return (
      <div className={`wrap ${styles.emptyContainer}`}>
        <ShoppingBag size={56} className={styles.emptyIcon} />
        <h2>{t('Giỏ hàng của bạn chưa có món nào', 'Your cart is empty')}</h2>
        <p>{t('Vui lòng chọn đồ uống từ Menu trước khi thanh toán.', 'Please choose drinks from the Menu before checkout.')}</p>
        <button className="btn btn-primary btn-lg" onClick={() => router.push('/menu')}>
          {t('Quay lại Thực Đơn Menu', 'Return to Menu')}
        </button>
      </div>
    );
  }

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const created = createOrder({
      customerName: customerName || 'Khách Vãng Lai',
      customerPhone: customerPhone || '0937936688',
      orderType,
      pickupTime: orderType === 'pickup' ? pickupTime : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      note,
      items: cart,
      subtotal,
      discountAmount,
      finalTotal,
      paymentMethod,
    });

    if (paymentMethod === 'sepay_qr') {
      setSepayModal({
        isOpen: true,
        orderId: created.id,
        sepayCode: created.sepayCode || `SEPAY${created.id.replace(/\D/g, '')}`,
      });
    } else {
      // COD
      addPoints(finalTotal);
      router.push(`/order/confirmation/${created.id}`);
    }
  };

  return (
    <div className={`wrap ${styles.checkoutPage}`}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('Thanh Toán Đơn Hàng', 'Order Checkout')}</h1>
        <p className={styles.sub}>{t('Hoàn tất thông tin đặt đồ uống & chọn phương thức thanh toán', 'Complete order info & payment method')}</p>
      </div>

      <form onSubmit={handlePlaceOrder} className={styles.checkoutGrid}>
        {/* LEFT COLUMN: FORM */}
        <div className={styles.formCol}>
          {/* 1. ORDER TYPE & TIME */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <Clock className={styles.sectionIcon} />
              <h3>{t('1. Hình thức nhận hàng', '1. Fulfillment Option')}</h3>
            </div>
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeBtn} ${orderType === 'pickup' ? styles.typeBtnActive : ''}`}
                onClick={() => setOrderType('pickup')}
              >
                <span>🛍️ {t('Tự đến lấy (Takeaway / Pickup)', 'Self Pickup')}</span>
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${orderType === 'delivery' ? styles.typeBtnActive : ''}`}
                onClick={() => setOrderType('delivery')}
              >
                <span>🛵 {t('Giao hàng tận nơi (Delivery)', 'Home Delivery')}</span>
              </button>
            </div>

            {orderType === 'pickup' ? (
              <div className={styles.inputGroup}>
                <label>{t('Chọn thời gian nhận đồ', 'Scheduled Pickup Time')}</label>
                <input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  required
                />
                <span className={styles.inputHint}>
                  📍 {t('Nhận tại: Quán Beanbus - Số 25-27 Thanh Bình, Hải Phòng', 'Pickup at: Beanbus - 25-27 Thanh Bình, Hải Phòng')}
                </span>
              </div>
            ) : (
              <div className={styles.inputGroup}>
                <label>{t('Địa chỉ giao hàng chi tiết', 'Detailed Delivery Address')} *</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t('Nhập số nhà, tên đường, quận huyện...', 'Enter street name, house number...')}
                  required
                />
              </div>
            )}
          </div>

          {/* 2. CUSTOMER CONTACT INFO */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <MapPin className={styles.sectionIcon} />
              <h3>{t('2. Thông tin khách hàng', '2. Customer Info')}</h3>
            </div>
            <div className={styles.rowTwo}>
              <div className={styles.inputGroup}>
                <label>{t('Họ và tên', 'Full Name')} *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label>{t('Số điện thoại', 'Phone Number')} *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0937 xxx xxx"
                  required
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>{t('Ghi chú cho Barista', 'Order Note')}</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('Ví dụ: Cho thêm đá riêng, không bỏ ống hút nhựa...', 'e.g. Extra ice on the side...')}
              />
            </div>
          </div>

          {/* 3. PAYMENT METHOD */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <ShieldCheck className={styles.sectionIcon} />
              <h3>{t('3. Phương thức thanh toán', '3. Payment Method')}</h3>
            </div>
            <div className={styles.paymentMethods}>
              <label
                className={`${styles.payCard} ${paymentMethod === 'sepay_qr' ? styles.payCardActive : ''}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'sepay_qr'}
                  onChange={() => setPaymentMethod('sepay_qr')}
                />
                <QrCode size={24} className={styles.payIcon} />
                <div className={styles.payText}>
                  <strong>{t('Thanh toán QR Code (Sepay Tự Động)', 'Sepay QR Code Payment')}</strong>
                  <span>{t('Gen mã VietQR chuẩn ngân hàng MB, kiểm tra giao dịch tức thì.', 'Instant VietQR auto check.')}</span>
                </div>
                <span className={styles.payBadge}>⚡ Recommeded</span>
              </label>

              <label
                className={`${styles.payCard} ${paymentMethod === 'cod' ? styles.payCardActive : ''}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <DollarSign size={24} className={styles.payIcon} />
                <div className={styles.payText}>
                  <strong>{t('Thanh toán khi nhận hàng (COD)', 'Cash on Delivery (COD)')}</strong>
                  <span>{t('Thanh toán bằng tiền mặt cho shipper hoặc khi nhận tại quầy.', 'Pay cash upon pickup or delivery.')}</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUMMARY */}
        <div className={styles.summaryCol}>
          <div className={styles.summaryCard}>
            <h3>{t('Tóm tắt đơn hàng', 'Order Summary')} ({cart.length} món)</h3>

            <div className={styles.itemsList}>
              {cart.map((item) => (
                <div key={item.cartItemId} className={styles.summaryItem}>
                  <img src={item.product.image} alt={item.product.nameVi} />
                  <div className={styles.itemMeta}>
                    <strong>{lang === 'en' ? item.product.nameEn : item.product.nameVi}</strong>
                    <span>x{item.quantity}</span>
                  </div>
                  <div className={styles.itemPrice}>
                    {item.itemTotal.toLocaleString('vi-VN')}đ
                  </div>
                </div>
              ))}
            </div>

            {appliedVoucher && (
              <div className={styles.voucherBadge}>
                <Tag size={14} />
                <span>Mã: {appliedVoucher.code}</span>
              </div>
            )}

            <div className={styles.totalsBox}>
              <div className={styles.row}>
                <span>{t('Tạm tính:', 'Subtotal:')}</span>
                <span>{subtotal.toLocaleString('vi-VN')}đ</span>
              </div>
              {discountAmount > 0 && (
                <div className={`${styles.row} ${styles.discount}`}>
                  <span>{t('Giảm giá:', 'Discount:')}</span>
                  <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className={`${styles.row} ${styles.final}`}>
                <span>{t('Tổng thanh toán:', 'Total:')}</span>
                <span className={styles.finalPrice}>
                  {finalTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
              <span>
                {paymentMethod === 'sepay_qr'
                  ? t('Tiếp Tục Quét Mã QR Sepay', 'Proceed to Sepay QR')
                  : t('Xác Nhận Đặt Hàng (COD)', 'Confirm Order (COD)')}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* SEPAY MODAL */}
      {sepayModal.isOpen && (
        <SepayQRModal
          orderId={sepayModal.orderId}
          sepayCode={sepayModal.sepayCode}
          finalTotal={finalTotal}
          onClose={() => setSepayModal({ isOpen: false, orderId: '', sepayCode: '' })}
        />
      )}
    </div>
  );
}
