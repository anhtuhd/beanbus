'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrders, type Order } from '@/context/OrderContext';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import type { UserProfile } from '@/lib/auth/types';
import type { MemberAccountOrder, MemberVoucher } from '@/lib/account/queries';
import {
  Award,
  ShoppingBag,
  Ticket,
  LogOut,
  QrCode,
  Gift,
  RotateCcw,
} from 'lucide-react';
import styles from './account.module.css';

export default function AccountClient({
  initialUser,
  production = false,
  initialOrders,
  availableVouchers,
  accountError,
}: {
  initialUser?: UserProfile;
  production?: boolean;
  initialOrders?: MemberAccountOrder[];
  availableVouchers?: MemberVoucher[];
  accountError?: string;
}) {
  const { user: contextUser, logout, redeemPoints } = useAuth();
  const user = initialUser ?? contextUser;
  const { orders } = useOrders();
  const { addToCart } = useCart();
  const { t, lang } = useLanguage();
  const productionOrders = initialOrders ?? [];
  const accountOrderCount = production ? productionOrders.length : orders.length;

  const [activeTab, setActiveTab] = useState<'membership' | 'orders' | 'vouchers' | 'rewards'>('membership');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);

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
      setRedeemSuccessMsg(`🎉 Bạn đã đổi thành công ${name}!`);
      setTimeout(() => setRedeemSuccessMsg(null), 3000);
    } else {
      alert(t('Bạn không đủ điểm thưởng!', 'Not enough points!'));
    }
  };

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addToCart(item.product, item.quantity, item.selectedOptions, item.specialNote);
    });
    alert(t('Đã thêm toàn bộ món từ đơn cũ vào giỏ hàng!', 'Reordered items added to cart!'));
  };

  if (!user) return null;

  return (
    <div className={`wrap ${styles.accountPage}`}>
      {/* USER PROFILE HEADER */}
      <div className={styles.userBanner}>
        <div className={styles.userMainInfo}>
          <img src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'} alt={user.name} className={styles.userAvatar} />
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

      {/* NAVIGATION TABS */}
      <div className={styles.navTabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'membership' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('membership')}
        >
          <Award size={16} /> <span>{t('Thẻ Hội Viên', 'Membership Card')}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingBag size={16} /> <span>{t('Lịch Sử Đơn Hàng', 'Order History')} ({accountOrderCount})</span>
        </button>

        {!production && <button
          className={`${styles.tabBtn} ${activeTab === 'rewards' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          <Gift size={16} /> <span>{t('Đổi Quà Đổi Điểm', 'Redeem Store')}</span>
        </button>}

        <button
          className={`${styles.tabBtn} ${activeTab === 'vouchers' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('vouchers')}
        >
          <Ticket size={16} /> <span>{t('Kho Voucher', 'Vouchers')}</span>
        </button>
      </div>

      {/* TAB 1: MEMBERSHIP CARD & PROGRESS */}
      {activeTab === 'membership' && (
        <div className={styles.tabContent}>
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
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeTab === 'orders' && (
        <div className={styles.tabContent}>
          {production ? (
            productionOrders.length === 0 ? (
              <p className={styles.emptyState}>{t('Bạn chưa có đơn hàng production nào.', 'No production orders yet.')}</p>
            ) : (
              <div className={styles.ordersList}>
                {productionOrders.map((order) => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHead}>
                      <div>
                        <strong>Đơn #{order.number}</strong>
                        <span className={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>{order.status}</span>
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
                      <strong>{order.totalVnd.toLocaleString('vi-VN')}đ</strong>
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
                      <strong>Đơn #{o.id}</strong>
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
        </div>
      )}

      {/* TAB 3: REWARDS REDEMPTION STORE */}
      {!production && activeTab === 'rewards' && (
        <div className={styles.tabContent}>
          {redeemSuccessMsg && (
            <div className={styles.successAlert}>{redeemSuccessMsg}</div>
          )}
          <div className={styles.rewardsGrid}>
            {rewardCatalog.map((r) => (
              <div key={r.id} className={styles.rewardCard}>
                <div className={styles.rPts}>{r.pts.toLocaleString('vi-VN')} đ</div>
                <h4>{lang === 'en' ? r.nameEn : r.nameVi}</h4>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={user.points < r.pts}
                  onClick={() => handleRedeem(r.pts, lang === 'en' ? r.nameEn : r.nameVi)}
                >
                  {user.points >= r.pts ? t('Đổi Quà Ngay', 'Redeem Now') : t('Chưa Đủ Điểm', 'Insufficient Pts')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: VOUCHERS */}
      {activeTab === 'vouchers' && (
        <div className={styles.tabContent}>
          {production ? (
            (availableVouchers ?? []).length === 0 ? (
              <p className={styles.emptyState}>{t('Hiện chưa có voucher khả dụng.', 'No active vouchers available.')}</p>
            ) : (
              <div className={styles.vouchersGrid}>
                {(availableVouchers ?? []).map((voucher) => (
                  <div key={voucher.code} className={styles.vCard}>
                    <div className={styles.vLeft}>{voucher.code}</div>
                    <div className={styles.vRight}>
                      <h4>{voucher.discount_type === 'percent' ? `Giảm ${voucher.discount_value}%` : `Giảm ${voucher.discount_value.toLocaleString('vi-VN')}đ`}</h4>
                      <p>Đơn tối thiểu {voucher.minimum_subtotal_vnd.toLocaleString('vi-VN')}đ</p>
                      {voucher.maximum_discount_vnd && <p>Tối đa {voucher.maximum_discount_vnd.toLocaleString('vi-VN')}đ</p>}
                      {voucher.ends_at && <p>Hạn dùng: {new Date(voucher.ends_at).toLocaleDateString('vi-VN')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : <div className={styles.vouchersGrid}>
            <div className={styles.vCard}>
              <div className={styles.vLeft}>BEANBUS10</div>
              <div className={styles.vRight}>
                <h4>Giảm 10% Tổng Đơn Hàng</h4>
                <p>Hạn dùng: 31/12/2026 • Áp dụng cho mọi đơn đồ uống</p>
              </div>
            </div>

            <div className={styles.vCard}>
              <div className={styles.vLeft}>WELCOMEVIP</div>
              <div className={styles.vRight}>
                <h4>Giảm 20.000đ Cho Hội Viên Mới</h4>
                <p>Dành riêng cho thành viên mới đăng ký tài khoản</p>
              </div>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}
