'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateMemberProfile } from './actions';
import { initialProfileUpdateState } from './profile-state';
import { loadReorderItems } from './reorder-actions';
import { initialReorderState } from './reorder-state';
import RewardRedeemForm from './RewardRedeemForm';
import PhoneVerificationPanel from './PhoneVerificationPanel';
import CancelBookingForm from './requests/CancelBookingForm';
import { useAuth } from '@/context/AuthContext';
import { useOrders, type Order } from '@/context/OrderContext';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import type { UserProfile } from '@/lib/auth/types';
import type { MemberAccountOrder, MemberLoyaltyEntry, MemberLoyaltySummary, MemberRequest, MemberReward, MemberVoucher } from '@/lib/account/queries';
import {
  Award,
  ArrowRight,
  ShoppingBag,
  Ticket,
  LogOut,
  QrCode,
  Gift,
  Inbox,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import styles from './account.module.css';

const VIETNAM_DATE_FORMATTER = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
export type AccountTab = 'membership' | 'orders' | 'requests' | 'vouchers' | 'rewards';

function formatDate(value: string): string {
  return VIETNAM_DATE_FORMATTER.format(new Date(value));
}

function statusLabel(status: string, t: (vi: string, en: string) => string): string {
  const labels: Record<string, [string, string]> = {
    pending: ['Chờ xử lý', 'Pending'],
    confirmed: ['Đã xác nhận', 'Confirmed'],
    preparing: ['Đang chuẩn bị', 'Preparing'],
    ready: ['Sẵn sàng', 'Ready'],
    completed: ['Hoàn tất', 'Completed'],
    cancelled: ['Đã hủy', 'Cancelled'],
    rejected: ['Từ chối', 'Rejected'],
    in_progress: ['Đang xử lý', 'In progress'],
    resolved: ['Đã giải quyết', 'Resolved'],
  };
  const [vi, en] = labels[status] ?? [status, status];
  return t(vi, en);
}

function loyaltySourceLabel(sourceType: MemberLoyaltyEntry['source_type'], t: (vi: string, en: string) => string): string {
  const labels: Record<MemberLoyaltyEntry['source_type'], [string, string]> = {
    order_earned: ['Tích điểm đơn hàng', 'Order reward'],
    order_reversal: ['Hoàn điểm đơn hàng', 'Order points reversal'],
    redemption: ['Đổi thưởng', 'Reward redemption'],
    manual_adjustment: ['Điều chỉnh thủ công', 'Manual adjustment'],
    topup_credited: ['Nạp điểm', 'Top-up credit'],
    flash_sale_credited: ['Flash-sale điểm thưởng', 'Flash-sale credit'],
    order_payment_debit: ['Dùng điểm thanh toán đơn', 'Points used for order payment'],
    order_payment_refund: ['Hoàn điểm thanh toán đơn', 'Order payment points refund'],
  };
  const [vi, en] = labels[sourceType];
  return t(vi, en);
}

export default function AccountClient({
  initialUser,
  production = false,
  phoneAuthEnabled = false,
  initialTab = 'membership',
  storedValueConfigured = false,
  initialOrders,
  availableVouchers,
  accountError,
  loyalty,
  loyaltyEntries = [],
  rewards = [],
  memberRequests = [],
  totalOrders = 0,
  totalRequests = 0,
  orderPage = 1,
  orderTotalPages = 1,
  loyaltyPage = 1,
  loyaltyTotalPages = 1,
  requestPage = 1,
  requestTotalPages = 1,
  rewardPage = 1,
  rewardTotalPages = 1,
  voucherPage = 1,
  voucherTotalPages = 1,
}: {
  initialUser?: UserProfile;
  production?: boolean;
  phoneAuthEnabled?: boolean;
  initialTab?: AccountTab;
  storedValueConfigured?: boolean;
  initialOrders?: MemberAccountOrder[];
  availableVouchers?: MemberVoucher[];
  accountError?: string;
  loyalty?: MemberLoyaltySummary | null;
  loyaltyEntries?: MemberLoyaltyEntry[];
  rewards?: MemberReward[];
  memberRequests?: MemberRequest[];
  totalOrders?: number;
  totalRequests?: number;
  orderPage?: number;
  orderTotalPages?: number;
  loyaltyPage?: number;
  loyaltyTotalPages?: number;
  requestPage?: number;
  requestTotalPages?: number;
  rewardPage?: number;
  rewardTotalPages?: number;
  voucherPage?: number;
  voucherTotalPages?: number;
}) {
  const { user: contextUser, logout, redeemPoints, updateProfile } = useAuth();
  const user = initialUser ?? contextUser;
  const canUseStoredValue = production && storedValueConfigured;
  const { orders, bookings, cancelBooking } = useOrders();
  const { addToCart, applyVoucherDetails } = useCart();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const productionOrders = initialOrders ?? [];
  const accountOrderCount = production ? totalOrders : orders.length;
  const accountRequestCount = production ? totalRequests : bookings.length;

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const tabRefs = useRef<Partial<Record<AccountTab, HTMLButtonElement | null>>>({});
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);
  const [demoProfileMessage, setDemoProfileMessage] = useState<string | null>(null);
  const [demoActionMessage, setDemoActionMessage] = useState<string | null>(null);
  const [profileState, profileAction, profilePending] = useActionState(updateMemberProfile, initialProfileUpdateState);
  const [reorderState, reorderAction, reorderPending] = useActionState(loadReorderItems, initialReorderState);
  const processedReorder = useRef<string | null>(null);
  const profileRefreshApplied = useRef(false);

  useEffect(() => {
    if (!production || profileState.status !== 'success' || profileRefreshApplied.current) return;
    profileRefreshApplied.current = true;
    router.refresh();
  }, [production, profileState, router]);

  const accountHref = (overrides: Partial<Record<'page' | 'loyaltyPage' | 'requestPage' | 'rewardPage' | 'voucherPage', number>> = {}) => {
    const params = new URLSearchParams({
      page: String(overrides.page ?? orderPage),
      loyaltyPage: String(overrides.loyaltyPage ?? loyaltyPage),
      requestPage: String(overrides.requestPage ?? requestPage),
      rewardPage: String(overrides.rewardPage ?? rewardPage),
      voucherPage: String(overrides.voucherPage ?? voucherPage),
      tab: activeTab,
    });
    return `/account?${params.toString()}`;
  };

  const handleTabChange = (nextTab: AccountTab) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams({
      page: String(orderPage),
      loyaltyPage: String(loyaltyPage),
      requestPage: String(requestPage),
      rewardPage: String(rewardPage),
      voucherPage: String(voucherPage),
      tab: nextTab,
    });
    router.push(`/account?${params.toString()}`);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs: AccountTab[] = ['membership', 'orders', 'requests', 'rewards', 'vouchers'];
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    handleTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const handleDemoProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') ?? '').trim();
    if (fullName.length < 2 || fullName.length > 100) {
      setDemoProfileMessage(t('Họ tên cần có từ 2 đến 100 ký tự.', 'Name must be between 2 and 100 characters.'));
      return;
    }
    updateProfile({
      name: fullName,
      phone: String(formData.get('phone') ?? '').trim(),
      birthday: String(formData.get('birthday') ?? '').trim(),
    });
    setDemoProfileMessage(t('Đã cập nhật hồ sơ.', 'Profile updated.'));
  };

  useEffect(() => {
    if (!production || reorderState.status !== 'success' || !reorderState.orderId || processedReorder.current === reorderState.orderId) return;
    reorderState.items.forEach((item) => addToCart(item.product, item.quantity, item.selectedOptions, item.specialNote));
    processedReorder.current = reorderState.orderId;
  }, [addToCart, production, reorderState]);

  // Rewards catalog — points now equal VND (1 pt = 1 VND)
  const rewardCatalog = [
    { id: 'rw-1', nameVi: '01 Ly Cold-Brew Quế Hoa Miễn Phí', nameEn: '01 Free Osmanthus Cold-Brew', pts: 65000 },
    { id: 'rw-2', nameVi: 'Voucher Giảm 50.000đ Đơn Hàng', nameEn: '50,000đ Off Order Voucher', pts: 120000 },
    { id: 'rw-3', nameVi: '01 Túi Hạt Cà Phê Fine Robusta 250g', nameEn: '01 Bag Fine Robusta 250g', pts: 180000 },
    { id: 'rw-4', nameVi: '01 Bánh Croissant Bơ Pháp Nướng Nóng', nameEn: '01 Hot French Butter Croissant', pts: 45000 },
  ];

  const handleRedeem = (cost: number, name: string) => {
    const success = redeemPoints(cost);
    if (success) {
      const message = `Bạn đã đổi thành công ${name}!`;
      setRedeemSuccessMsg(`🎉 ${message}`);
      setDemoActionMessage(message);
      setTimeout(() => setRedeemSuccessMsg(null), 3000);
    } else {
      setDemoActionMessage(t('Bạn không đủ điểm thưởng!', 'Not enough points!'));
    }
  };

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addToCart(item.product, item.quantity, item.selectedOptions, item.specialNote);
    });
    setDemoActionMessage(t('Đã thêm toàn bộ món từ đơn cũ vào giỏ hàng!', 'Reordered items added to cart!'));
  };

  const handleUseVoucher = ({
    code,
    discountType,
    discountValue,
    descriptionVi,
    descriptionEn,
  }: {
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    descriptionVi: string;
    descriptionEn: string;
  }) => {
    applyVoucherDetails({ code, discountType, discountValue, descriptionVi, descriptionEn });
    router.push('/order/cart');
  };

  const handleCancelDemoBooking = (bookingId: string) => {
    cancelBooking(bookingId);
    setDemoActionMessage(t('Đã hủy yêu cầu đặt bàn.', 'Booking request cancelled.'));
  };

  if (!user) return null;

  return (
    <div className={`wrap ${styles.accountPage}`}>
      {/* USER PROFILE HEADER */}
      <div className={styles.userBanner}>
        <div className={styles.userMainInfo}>
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={72}
              height={72}
              unoptimized
              className={styles.userAvatar}
            />
          ) : (
            <div className={`${styles.userAvatar} ${styles.userAvatarFallback}`} aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase() || 'B'}
            </div>
          )}
          <div className={styles.userNameBox}>
            <h2>{user.name}</h2>
            <div className={styles.badgesRow}>
              <span className={`${styles.tierBadge} ${styles[user.tier.toLowerCase()]}`}>
                ⭐ {t(`Hạng ${user.tier}`, `${user.tier} Member`)}
              </span>
              <span className={styles.memberCode}>ID: {user.memberCode}</span>
            </div>
          </div>
        </div>

        <div className={styles.pointsWidget}>
          {production && loyalty && (
            <>
              <div className={styles.ptLabel}>{loyalty.policyEnabled ? t('Điểm thưởng', 'Reward points') : t('Điểm thưởng chưa kích hoạt', 'Rewards not activated')}</div>
              <div className={styles.ptValue}>{loyalty.balancePoints.toLocaleString('vi-VN')} <span>{t('điểm', 'pts')}</span></div>
              {loyalty.debtPoints > 0 && <small>{t(`Đang âm ${loyalty.debtPoints.toLocaleString('vi-VN')} điểm`, `Negative balance ${loyalty.debtPoints.toLocaleString('vi-VN')} pts`)}</small>}
            </>
          )}
          {!production && (
            <>
              <div className={styles.ptLabel}>{t('Số Dư Ví Điểm', 'Wallet Balance')}</div>
              <div className={styles.ptValue}>{user.points.toLocaleString('vi-VN')} <span>đ</span></div>
            </>
          )}
          <button className={styles.logoutBtn} onClick={logout}>
            <LogOut size={14} /> <span>{t('Đăng xuất', 'Log out')}</span>
          </button>
        </div>
      </div>

      {accountError && <div className={styles.accountStatus} role="alert">{accountError}</div>}
      {!production && demoActionMessage && <div className={styles.formSuccess} role="status" aria-live="polite">{demoActionMessage}</div>}
      {production && reorderState.status !== 'idle' && (
        <div className={reorderState.status === 'error' ? styles.accountStatus : styles.formSuccess} role={reorderState.status === 'error' ? 'alert' : 'status'} aria-live={reorderState.status === 'error' ? 'assertive' : 'polite'}>
          {reorderState.message}
        </div>
      )}

      {/* MEMBER DASHBOARD NAVIGATION */}
      <nav className={styles.accountNavigation} aria-label={t('Khu vực tài khoản', 'Account sections')}>
        <div className={styles.navTabs} role="tablist" aria-label={t('Nội dung tài khoản', 'Account content')}>
          <button
            type="button"
            role="tab"
            id="membership-tab"
            aria-selected={activeTab === 'membership'}
            aria-controls="membership-panel"
            tabIndex={activeTab === 'membership' ? 0 : -1}
            ref={(element) => { tabRefs.current.membership = element; }}
            onKeyDown={handleTabKeyDown}
            className={`${styles.tabBtn} ${activeTab === 'membership' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('membership')}
          >
            <Award size={16} /> <span>{t('Thẻ Hội Viên', 'Membership Card')}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="orders-tab"
            aria-selected={activeTab === 'orders'}
            aria-controls="orders-panel"
            tabIndex={activeTab === 'orders' ? 0 : -1}
            ref={(element) => { tabRefs.current.orders = element; }}
            onKeyDown={handleTabKeyDown}
            className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('orders')}
          >
            <ShoppingBag size={16} /> <span>{t('Lịch Sử Đơn Hàng', 'Order History')} ({accountOrderCount})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="requests-tab"
            aria-selected={activeTab === 'requests'}
            aria-controls="requests-panel"
            tabIndex={activeTab === 'requests' ? 0 : -1}
            ref={(element) => { tabRefs.current.requests = element; }}
            onKeyDown={handleTabKeyDown}
            className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('requests')}
          >
            <Inbox size={16} /> <span>{t('Yêu cầu của tôi', 'My Requests')} ({accountRequestCount})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="rewards-tab"
            aria-selected={activeTab === 'rewards'}
            aria-controls="rewards-panel"
            tabIndex={activeTab === 'rewards' ? 0 : -1}
            ref={(element) => { tabRefs.current.rewards = element; }}
            onKeyDown={handleTabKeyDown}
            className={`${styles.tabBtn} ${activeTab === 'rewards' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('rewards')}
          >
            <Gift size={16} /> <span>{t('Đổi Quà Đổi Điểm', 'Redeem Store')}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="vouchers-tab"
            aria-selected={activeTab === 'vouchers'}
            aria-controls="vouchers-panel"
            tabIndex={activeTab === 'vouchers' ? 0 : -1}
            ref={(element) => { tabRefs.current.vouchers = element; }}
            onKeyDown={handleTabKeyDown}
            className={`${styles.tabBtn} ${activeTab === 'vouchers' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('vouchers')}
          >
            <Ticket size={16} /> <span>{t('Kho Voucher', 'Vouchers')}</span>
          </button>
        </div>

        {canUseStoredValue && (
          <div className={styles.navLinks} aria-label={t('Chương trình điểm', 'Points programs')}>
            <Link href="/account/topup" className={styles.navLink}>
              <span>{t('Nạp điểm', 'Top up points')}</span>
            </Link>
            <Link href="/flash-sale" className={styles.navLink}>
              <span>{t('Flash-sale', 'Flash sale')}</span>
            </Link>
            <Link href="/account/payment-history" className={styles.navLink}>
              <span>{t('Lịch sử giao dịch', 'Transaction history')}</span>
            </Link>
          </div>
        )}
      </nav>

      {/* TAB 1: MEMBERSHIP CARD & PROGRESS */}
      {activeTab === 'membership' && (
        <div id="membership-panel" role="tabpanel" aria-labelledby="membership-tab" className={styles.tabContent}>
          {/* DIGITAL CARD */}
          <div className={styles.digitalCard}>
            <div className={styles.cardTop}>
              <div className={styles.cBrand}>BEANBUS COFFEE ROASTER</div>
              <div className={styles.cTier}>{user.tier}</div>
            </div>
            <div className={styles.cardMid}>
              <div className={styles.cQr}>
                <QrCode size={64} />
              </div>
              <div className={styles.cInfo}>
                <span className={styles.cName}>{user.name}</span>
                <span className={styles.cCode}>{user.memberCode}</span>
                <span className={styles.cPhone}>{user.phone}</span>
              </div>
            </div>
            <div className={styles.cardBot}>
              <span>{t('Quét mã tại quầy để tích điểm & nhận ưu đãi', 'Scan at counter for points & discounts')}</span>
            </div>
          </div>

          {/* PROGRESS TO NEXT TIER */}
          {!production && <div className={styles.tierProgressCard}>
            <h3>{t('Tiến trình nâng hạng', 'Tier Progress')}</h3>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(100, (user.totalSpent / 5000000) * 100)}%` }}
              ></div>
            </div>
            <div className={styles.progressMeta}>
              <span>{t('Tổng chi tiêu:', 'Total spent:')} {user.totalSpent.toLocaleString('vi-VN')}đ</span>
              <span>{t('Hạng tiếp theo: Platinum (5.000.000đ)', 'Next tier: Platinum')}</span>
            </div>
          </div>}

          <form
            action={production ? profileAction : undefined}
            onSubmit={production ? () => { profileRefreshApplied.current = false; } : handleDemoProfileSubmit}
            className={styles.profileForm}
          >
            <h3>{t('Thông tin cá nhân', 'Personal details')}</h3>
            <div className={styles.profileFields}>
              <label>
                {t('Họ và tên', 'Full name')}
                <input name="fullName" defaultValue={user.name} maxLength={100} required disabled={profilePending} />
              </label>
              {!production && <label>
                {t('Số điện thoại', 'Phone number')}
                <input name="phone" type="tel" inputMode="tel" defaultValue={user.phone} placeholder="0987 654 321" disabled={profilePending} />
              </label>}
              <label>
                {t('Ngày sinh', 'Birthday')}
                <input name="birthday" type="date" defaultValue={user.birthday || undefined} disabled={profilePending} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={profilePending}>
              {profilePending ? t('Đang lưu...', 'Saving...') : t('Lưu hồ sơ', 'Save profile')}
            </button>
            {!production && demoProfileMessage && <p className={styles.formSuccess} role="status">{demoProfileMessage}</p>}
            {production && profileState.status !== 'idle' && (
              <p className={profileState.status === 'error' ? styles.formError : styles.formSuccess} role={profileState.status === 'error' ? 'alert' : 'status'} aria-live={profileState.status === 'error' ? 'assertive' : 'polite'}>{profileState.message}</p>
            )}
          </form>

          {production && (
            <PhoneVerificationPanel currentPhone={user.phone} enabled={phoneAuthEnabled} />
          )}

          {production && loyalty && (
            <section className={styles.loyaltyHistory} aria-labelledby="loyalty-history-title">
              <div className={styles.loyaltyHistoryHeader}>
                <h3 id="loyalty-history-title">{t('Lịch sử điểm', 'Points history')}</h3>
                <span>{t('20 giao dịch gần nhất', 'Last 20 transactions')}</span>
              </div>
              {loyaltyEntries.length === 0 ? (
                <p className={styles.emptyState}>{t('Chưa có giao dịch điểm.', 'No points transactions yet.')}</p>
              ) : (
                <div className={styles.loyaltyEntryList}>
                  {loyaltyEntries.map((entry) => (
                    <div key={entry.id} className={styles.loyaltyEntry}>
                      <div>
                        <strong>{loyaltySourceLabel(entry.source_type, t)}</strong>
                        <small>{entry.note ?? entry.voucher_code ?? t('Giao dịch hệ thống', 'System transaction')}</small>
                      </div>
                      <div className={entry.points > 0 ? styles.pointsPositive : styles.pointsNegative}>{entry.points > 0 ? '+' : ''}{entry.points.toLocaleString('vi-VN')} {t('điểm', 'pts')}</div>
                      <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                    </div>
                  ))}
                </div>
              )}
              {production && loyaltyTotalPages > 1 && (
                <nav className={styles.pagination} aria-label={t('Phân trang lịch sử điểm', 'Points history pagination')}>
              {loyaltyPage > 1 && <Link href={accountHref({ loyaltyPage: loyaltyPage - 1 })} aria-label={t('Trang điểm trước', 'Previous points page')}>←</Link>}
                  <span>{t(`Trang ${loyaltyPage} / ${loyaltyTotalPages}`, `Page ${loyaltyPage} / ${loyaltyTotalPages}`)}</span>
              {loyaltyPage < loyaltyTotalPages && <Link href={accountHref({ loyaltyPage: loyaltyPage + 1 })} aria-label={t('Trang điểm sau', 'Next points page')}>→</Link>}
                </nav>
              )}
            </section>
          )}
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === 'orders' && (
        <div id="orders-panel" role="tabpanel" aria-labelledby="orders-tab" className={styles.tabContent}>
          {production ? (
            productionOrders.length === 0 ? (
              <p className={styles.emptyState}>{t('Bạn chưa có đơn hàng production nào.', 'No production orders yet.')}</p>
            ) : (
              <div className={styles.ordersList}>
                {productionOrders.map((order) => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHead}>
                      <div>
                        <Link href={`/account/orders/${order.id}`} className={styles.orderLink}>{t('Đơn', 'Order')} #{order.code}</Link>
                        <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>{statusLabel(order.status, t)}</span>
                    </div>
                    <div className={styles.orderItems}>
                      {order.items.map((item) => (
                        <div key={item.id} className={styles.itemLine}>
                          <span>{lang === 'en' ? item.nameEn : item.nameVi} x{item.quantity}</span>
                          <span>{item.lineTotalVnd.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.orderFoot}>
                      <span>{order.fulfillment === 'pickup' ? t('Nhận tại quán', 'Pickup') : t('Giao hàng', 'Delivery')}</span>
                      <strong>{t('Còn thanh toán:', 'Cash due:')} {order.cashDueVnd.toLocaleString('vi-VN')}đ</strong>
                      {order.pointsApplied > 0 && <small>{t(`Đã dùng ${order.pointsApplied.toLocaleString('vi-VN')} điểm`, `${order.pointsApplied.toLocaleString('vi-VN')} pts used`)}</small>}
                      <form action={reorderAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <button type="submit" className="btn btn-dark btn-sm" disabled={reorderPending}>
                          <RotateCcw size={14} />
                          <span>{reorderPending ? t('Đang tải...', 'Loading...') : t('Đặt lại', 'Reorder')}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : orders.length === 0 ? (
            <p>{t('Bạn chưa có đơn hàng nào.', 'No orders found.')}</p>
          ) : (
            <div className={styles.ordersList}>
              {orders.map((o) => (
                <div key={o.id} className={styles.orderCard}>
                  <div className={styles.orderHead}>
                    <div>
                      <strong>{t('Đơn', 'Order')} #{o.id}</strong>
                      <span className={styles.orderDate}>{o.createdAt.substring(0, 10)}</span>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[o.status]}`}>
                      {o.status.toUpperCase()}
                    </span>
                  </div>

                  <div className={styles.orderItems}>
                    {o.items.map((i) => (
                      <div key={i.cartItemId} className={styles.itemLine}>
                        <span>{lang === 'en' ? i.product.nameEn : i.product.nameVi} x{i.quantity}</span>
                        <span>{i.itemTotal.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.orderFoot}>
                    <div className={styles.orderTotal}>
                      {t('Tổng tiền:', 'Total:')} <strong>{o.finalTotal.toLocaleString('vi-VN')}đ</strong>
                    </div>
                    <button className="btn btn-dark btn-sm" onClick={() => handleReorder(o)}>
                      <RotateCcw size={14} />
                      <span>{t('Đặt lại đơn này', 'Reorder')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {production && orderTotalPages > 1 && (
            <nav className={styles.pagination} aria-label={t('Phân trang đơn hàng', 'Order pagination')}>
              {orderPage > 1 && <Link href={accountHref({ page: orderPage - 1 })} aria-label={t('Trang trước', 'Previous page')}>←</Link>}
              <span>{t(`Trang ${orderPage} / ${orderTotalPages}`, `Page ${orderPage} / ${orderTotalPages}`)}</span>
              {orderPage < orderTotalPages && <Link href={accountHref({ page: orderPage + 1 })} aria-label={t('Trang sau', 'Next page')}>→</Link>}
            </nav>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div id="requests-panel" role="tabpanel" aria-labelledby="requests-tab" className={styles.tabContent}>
          {production ? memberRequests.length === 0 ? <p className={styles.emptyState}>{t('Bạn chưa gửi yêu cầu nào.', 'No requests yet.')}</p> : (
            <>
              <div className={styles.ordersList}>
                {memberRequests.map((request) => (
                  <article key={`${request.kind}-${request.id}`} className={styles.orderCard}>
                    <div className={styles.orderHead}>
                      <div><Link href={`/account/requests/${request.id}?kind=${request.kind}`} className={styles.orderLink}><strong>{request.requestType === 'booking' ? 'BK' : request.requestType.toUpperCase()} #{request.referenceNumber}</strong></Link><span className={styles.orderDate}>{formatDate(request.createdAt)}</span></div>
                      <span className={`${styles.statusBadge} ${styles[`status_${request.status}`]}`}>{statusLabel(request.status, t)}</span>
                    </div>
                    <div className={styles.itemLine}><span>{request.subject}</span><span>{request.notificationStatus === 'sent' ? t('Đã gửi thông báo', 'Notification sent') : request.notificationStatus === 'failed' ? t('Thông báo lỗi', 'Notification failed') : t('Thông báo chưa cấu hình', 'Notification not configured')}</span></div>
                    <CancelBookingForm requestId={request.id} currentStatus={request.status} kind={request.kind} />
                  </article>
                ))}
              </div>
              {requestTotalPages > 1 && (
                <nav className={styles.pagination} aria-label={t('Phân trang yêu cầu', 'Request history pagination')}>
                  {requestPage > 1 && <Link href={accountHref({ requestPage: requestPage - 1 })} aria-label={t('Trang yêu cầu trước', 'Previous requests page')}>←</Link>}
                  <span>{t(`Trang ${requestPage} / ${requestTotalPages}`, `Page ${requestPage} / ${requestTotalPages}`)}</span>
                  {requestPage < requestTotalPages && <Link href={accountHref({ requestPage: requestPage + 1 })} aria-label={t('Trang yêu cầu sau', 'Next requests page')}>→</Link>}
                </nav>
              )}
            </>
          ) : bookings.length === 0 ? (
            <p className={styles.emptyState}>{t('Bạn chưa có yêu cầu đặt bàn nào.', 'No booking requests yet.')}</p>
          ) : (
            <div className={styles.ordersList}>
              {bookings.map((booking) => (
                <article key={booking.id} className={styles.orderCard}>
                  <div className={styles.orderHead}>
                    <div>
                      <strong>{t('Đặt bàn', 'Booking')} #{booking.id}</strong>
                      <span className={styles.orderDate}>{booking.date} · {booking.time}</span>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[`status_${booking.status}`]}`}>
                      {statusLabel(booking.status, t)}
                    </span>
                  </div>
                  <div className={styles.itemLine}>
                    <span>{booking.guestCount} {t('khách', 'guests')} · {booking.seatingArea}</span>
                    <span>{booking.note || t('Không có ghi chú', 'No note')}</span>
                  </div>
                  {booking.status !== 'cancelled' && (
                    <div className={styles.requestActions}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCancelDemoBooking(booking.id)}>
                        <XCircle size={14} aria-hidden="true" />
                        <span>{t('Hủy đặt bàn', 'Cancel booking')}</span>
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REWARDS REDEMPTION STORE */}
      {activeTab === 'rewards' && (
        <div id="rewards-panel" role="tabpanel" aria-labelledby="rewards-tab" className={styles.tabContent}>
          {production ? (
            rewards.length === 0 ? <p className={styles.emptyState}>{t('Hiện chưa có phần thưởng khả dụng.', 'No rewards available.')}</p> : (
              <>
                <div className={styles.rewardsGrid}>
                  {rewards.map((reward) => (
                    <div key={reward.id} className={styles.rewardCard}>
                      <div className={styles.rPts}>{reward.points_cost.toLocaleString('vi-VN')} {t('điểm', 'pts')}</div>
                      <h4>{lang === 'en' ? reward.name_en : reward.name_vi}</h4>
                      <p>{reward.discount_type === 'percent' ? `Giảm ${reward.discount_value}%` : `Giảm ${reward.discount_value.toLocaleString('vi-VN')}đ`}</p>
                      <RewardRedeemForm rewardId={reward.id} disabled={!loyalty?.policyEnabled} />
                    </div>
                  ))}
                </div>
                {rewardTotalPages > 1 && (
                  <nav className={styles.pagination} aria-label={t('Phân trang phần thưởng', 'Rewards pagination')}>
                    {rewardPage > 1 && <Link href={accountHref({ rewardPage: rewardPage - 1 })} aria-label={t('Trang phần thưởng trước', 'Previous rewards page')}>←</Link>}
                    <span>{t(`Trang ${rewardPage} / ${rewardTotalPages}`, `Page ${rewardPage} / ${rewardTotalPages}`)}</span>
                    {rewardPage < rewardTotalPages && <Link href={accountHref({ rewardPage: rewardPage + 1 })} aria-label={t('Trang phần thưởng sau', 'Next rewards page')}>→</Link>}
                  </nav>
                )}
              </>
            )
          ) : (
            <>
              {redeemSuccessMsg && <div className={styles.successAlert}>{redeemSuccessMsg}</div>}
              <div className={styles.rewardsGrid}>
                {rewardCatalog.map((r) => (
                  <div key={r.id} className={styles.rewardCard}>
                    <div className={styles.rPts}>{r.pts.toLocaleString('vi-VN')} đ</div>
                    <h4>{lang === 'en' ? r.nameEn : r.nameVi}</h4>
                    <button className="btn btn-primary btn-sm" disabled={user.points < r.pts} onClick={() => handleRedeem(r.pts, lang === 'en' ? r.nameEn : r.nameVi)}>
                      {user.points >= r.pts ? t('Đổi Quà Ngay', 'Redeem Now') : t('Chưa Đủ Điểm', 'Insufficient Pts')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: VOUCHERS */}
      {activeTab === 'vouchers' && (
        <div id="vouchers-panel" role="tabpanel" aria-labelledby="vouchers-tab" className={styles.tabContent}>
          {production ? (
            (availableVouchers ?? []).length === 0 ? (
              <p className={styles.emptyState}>{t('Hiện chưa có voucher khả dụng.', 'No active vouchers available.')}</p>
            ) : (
              <>
                <div className={styles.vouchersGrid}>
                  {(availableVouchers ?? []).map((voucher) => (
                    <div key={voucher.code} className={styles.vCard}>
                      <div className={styles.vLeft}>{voucher.code}</div>
                      <div className={styles.vRight}>
                        <h4>{voucher.discount_type === 'percent' ? `Giảm ${voucher.discount_value}%` : `Giảm ${voucher.discount_value.toLocaleString('vi-VN')}đ`}</h4>
                        <p>Đơn tối thiểu {voucher.minimum_subtotal_vnd.toLocaleString('vi-VN')}đ</p>
                        {voucher.maximum_discount_vnd && <p>Tối đa {voucher.maximum_discount_vnd.toLocaleString('vi-VN')}đ</p>}
                        {voucher.ends_at && <p>Hạn dùng: {formatDate(voucher.ends_at)}</p>}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleUseVoucher({
                            code: voucher.code,
                            discountType: voucher.discount_type,
                            discountValue: voucher.discount_value,
                            descriptionVi: voucher.discount_type === 'percent' ? `Giảm ${voucher.discount_value}%` : `Giảm ${voucher.discount_value.toLocaleString('vi-VN')}đ`,
                            descriptionEn: voucher.discount_type === 'percent' ? `${voucher.discount_value}% off` : `${voucher.discount_value.toLocaleString('en-US')} VND off`,
                          })}
                        >
                          <span>{t('Dùng voucher', 'Use voucher')}</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {voucherTotalPages > 1 && (
                  <nav className={styles.pagination} aria-label={t('Phân trang voucher', 'Voucher pagination')}>
                    {voucherPage > 1 && <Link href={accountHref({ voucherPage: voucherPage - 1 })} aria-label={t('Trang voucher trước', 'Previous vouchers page')}>←</Link>}
                    <span>{t(`Trang ${voucherPage} / ${voucherTotalPages}`, `Page ${voucherPage} / ${voucherTotalPages}`)}</span>
                    {voucherPage < voucherTotalPages && <Link href={accountHref({ voucherPage: voucherPage + 1 })} aria-label={t('Trang voucher sau', 'Next vouchers page')}>→</Link>}
                  </nav>
                )}
              </>
            )
          ) : <div className={styles.vouchersGrid}>
            <div className={styles.vCard}>
              <div className={styles.vLeft}>BEANBUS10</div>
              <div className={styles.vRight}>
                <h4>Giảm 10% Tổng Đơn Hàng</h4>
                <p>Hạn dùng: 31/12/2026 • Áp dụng cho mọi đơn đồ uống</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUseVoucher({ code: 'BEANBUS10', discountType: 'percent', discountValue: 10, descriptionVi: 'Giảm 10% tổng đơn hàng', descriptionEn: '10% off total order' })}>
                  <span>{t('Dùng voucher', 'Use voucher')}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className={styles.vCard}>
              <div className={styles.vLeft}>WELCOMEVIP</div>
              <div className={styles.vRight}>
                <h4>Giảm 20.000đ Cho Hội Viên Mới</h4>
                <p>Dành riêng cho thành viên mới đăng ký tài khoản</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUseVoucher({ code: 'WELCOMEVIP', discountType: 'fixed', discountValue: 20000, descriptionVi: 'Giảm 20.000đ cho hội viên mới', descriptionEn: '20,000 VND off for new members' })}>
                  <span>{t('Dùng voucher', 'Use voucher')}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}
