'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useOrders, type Booking, type OrderStatus } from '@/context/OrderContext';
import { PRODUCTS, Product } from '@/data/products';
import { useLanguage } from '@/context/LanguageContext';
import {
  Shield,
  ShoppingBag,
  Users,
  Calendar,
  DollarSign,
  Plus,
  X,
  TriangleAlert,
} from 'lucide-react';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import { isNextOptimizedImage } from '@/lib/media/image';
import styles from './admin.module.css';

type AdminTab = 'orders' | 'menu' | 'bookings';

export default function AdminClient() {
  const { orders, updateOrderStatus, bookings, updateBookingStatus } = useOrders();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});
  const [orderFilter, setOrderFilter] = useState<string>('all');
  // Menu state simulation
  const [menuList, setMenuList] = useState<Product[]>(PRODUCTS);
  const [newProductModal, setNewProductModal] = useState(false);
  const newProductDialogRef = useDialogFocus<HTMLDivElement>(newProductModal, () => setNewProductModal(false));
  const [prodNameVi, setProdNameVi] = useState('');
  const [prodPrice, setProdPrice] = useState('40000');
  const [demoActionMessage, setDemoActionMessage] = useState('');

  // Stats calculation
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + o.finalTotal, 0);

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  const handleToggleAvailable = (id: string) => {
    setMenuList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newP: Product = {
      id: `p-new-${Date.now()}`,
      categoryId: 'espresso',
      nameVi: prodNameVi,
      nameEn: prodNameVi,
      descriptionVi: 'Món mới ra mắt tại Beanbus',
      descriptionEn: 'New arrival at Beanbus',
      price: Number(prodPrice) || 40000,
      image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
      isAvailable: true,
    };
    setMenuList([newP, ...menuList]);
    setNewProductModal(false);
    setProdNameVi('');
  };

  const handleBookingStatusChange = (booking: Booking, status: Booking['status']) => {
    updateBookingStatus(booking.id, status);
    setDemoActionMessage(`Đã cập nhật trạng thái đặt bàn ${booking.id}.`);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs: AdminTab[] = ['orders', 'menu', 'bookings'];
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className={`wrap ${styles.adminPage}`}>
      {/* ADMIN HEADER */}
      <div className={styles.adminBanner}>
        <div className={styles.adminTitleBox}>
          <Shield size={32} className={styles.shieldIcon} />
          <div>
            <h1>{t('Admin Dashboard — Beanbus Coffee', 'Admin Dashboard — Beanbus')}</h1>
            <p>{t('Hệ thống quản lý đơn hàng, thực đơn & hội viên tập trung', 'Centralized order, menu & member management system')}</p>
          </div>
        </div>
        <span className={styles.demoNotice} role="status">
          <TriangleAlert size={14} />
          <span>{t('Chế độ demo · Dữ liệu chỉ lưu trong trình duyệt', 'Demo mode · Browser-only data')}</span>
        </span>
      </div>

      {/* METRIC KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><DollarSign size={24} /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('Doanh Thu Đã Thu', 'Total Revenue')}</span>
            <span className={styles.kpiValue}>{totalRevenue.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><ShoppingBag size={24} /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('Tổng Số Đơn Hàng', 'Total Orders')}</span>
            <span className={styles.kpiValue}>{orders.length} {t('đơn', 'orders')}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Calendar size={24} /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('Đặt Bàn Trước', 'Table Reservations')}</span>
            <span className={styles.kpiValue}>{bookings.length} {t('lượt', 'bookings')}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Users size={24} /></div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{t('Thành Viên Active', 'Active Members')}</span>
            <span className={styles.kpiValue}>1,240 {t('hội viên', 'members')}</span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className={styles.tabNav} role="tablist" aria-label={t('Khu vực quản trị', 'Admin sections')}>
        <button
          type="button"
          role="tab"
          id="admin-orders-tab"
          aria-selected={activeTab === 'orders'}
          aria-controls="admin-orders-panel"
          tabIndex={activeTab === 'orders' ? 0 : -1}
          ref={(element) => { tabRefs.current.orders = element; }}
          onKeyDown={handleTabKeyDown}
          className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📦 {t('Quản lý Đơn hàng', 'Order Management')} ({orders.length})
        </button>

        <button
          type="button"
          role="tab"
          id="admin-menu-tab"
          aria-selected={activeTab === 'menu'}
          aria-controls="admin-menu-panel"
          tabIndex={activeTab === 'menu' ? 0 : -1}
          ref={(element) => { tabRefs.current.menu = element; }}
          onKeyDown={handleTabKeyDown}
          className={`${styles.tabBtn} ${activeTab === 'menu' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍵 {t('Quản lý Thực đơn Menu', 'Menu Items')} ({menuList.length})
        </button>

        <button
          type="button"
          role="tab"
          id="admin-bookings-tab"
          aria-selected={activeTab === 'bookings'}
          aria-controls="admin-bookings-panel"
          tabIndex={activeTab === 'bookings' ? 0 : -1}
          ref={(element) => { tabRefs.current.bookings = element; }}
          onKeyDown={handleTabKeyDown}
          className={`${styles.tabBtn} ${activeTab === 'bookings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          📅 {t('Quản lý Đặt bàn', 'Bookings')} ({bookings.length})
        </button>
      </div>

      {/* TAB 1: ORDER MANAGEMENT */}
      {activeTab === 'orders' && (
        <div id="admin-orders-panel" role="tabpanel" aria-labelledby="admin-orders-tab" className={styles.tabSection}>
          <div className={styles.filterBar}>
            <span>{t('Lọc theo trạng thái:', 'Filter status:')}</span>
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
            >
              <option value="all">{t('Tất cả trạng thái', 'All Statuses')}</option>
              <option value="pending">Pending (Chờ duyệt)</option>
              <option value="confirmed">Confirmed (Đã xác nhận)</option>
              <option value="preparing">Preparing (Đang pha chế)</option>
              <option value="ready">Ready (Sẵn sàng)</option>
              <option value="completed">Completed (Hoàn thành)</option>
            </select>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Loại đơn</th>
                  <th>Tổng tiền</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái đơn</th>
                  <th>Cập nhật nhanh</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>#{o.id}</strong></td>
                    <td>
                      <div><strong>{o.customerName}</strong></div>
                      <span className={styles.subText}>{o.customerPhone}</span>
                    </td>
                    <td>{o.orderType === 'pickup' ? '🛍️ Pickup' : '🛵 Delivery'}</td>
                    <td className={styles.priceTd}>{o.finalTotal.toLocaleString('vi-VN')}đ</td>
                    <td>
                      <span className={`${styles.badge} ${o.paymentStatus === 'paid' ? styles.bgPaid : styles.bgPending}`}>
                        {o.paymentMethod === 'sepay_qr' ? 'Sepay QR' : 'COD'}: {o.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles['status_' + o.status]}`}>
                        {o.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={o.status}
                        onChange={(e) =>
                          updateOrderStatus(
                            o.id,
                            e.target.value as OrderStatus,
                            e.target.value === 'completed' ? 'paid' : o.paymentStatus
                          )
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MENU MANAGEMENT */}
      {activeTab === 'menu' && (
        <div id="admin-menu-panel" role="tabpanel" aria-labelledby="admin-menu-tab" className={styles.tabSection}>
          <div className={styles.menuTopActions}>
            <button className="btn btn-primary" onClick={() => setNewProductModal(true)}>
              <Plus size={16} />
              <span>{t('Thêm Món Mới Vào Menu', 'Add New Menu Item')}</span>
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Hình ảnh</th>
                  <th>Tên món</th>
                  <th>Danh mục</th>
                  <th>Giá bán</th>
                  <th>Trạng thái bán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {menuList.map((item) => (
                  <tr key={item.id}>
                    <td><Image src={item.image} alt="" width={56} height={56} unoptimized={!isNextOptimizedImage(item.image)} className={styles.tableImg} /></td>
                    <td><strong>{item.nameVi}</strong></td>
                    <td>{item.categoryId}</td>
                    <td className={styles.priceTd}>{item.price.toLocaleString('vi-VN')}đ</td>
                    <td>
                      <span className={`${styles.badge} ${item.isAvailable ? styles.bgPaid : styles.bgPending}`}>
                        {item.isAvailable ? 'Còn hàng' : 'Tạm hết'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-dark btn-sm"
                        onClick={() => handleToggleAvailable(item.id)}
                      >
                        {item.isAvailable ? 'Đánh dấu Hết Hàng' : 'Đánh dấu Còn Hàng'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BOOKINGS MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div id="admin-bookings-panel" role="tabpanel" aria-labelledby="admin-bookings-tab" className={styles.tabSection}>
          {demoActionMessage && <p className={styles.dashboardNotice} role="status" aria-live="polite">{demoActionMessage}</p>}
          <div className={styles.tableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Mã đặt bàn</th>
                  <th>Tên khách hàng</th>
                  <th>Số ĐT</th>
                  <th>Ngày & Giờ</th>
                  <th>Số khách</th>
                  <th>Khu vực</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td><strong>#{b.id}</strong></td>
                    <td>{b.name}</td>
                    <td>{b.phone}</td>
                    <td>{b.date} ({b.time})</td>
                    <td>{b.guestCount} người</td>
                    <td>{b.seatingArea}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={b.status}
                        aria-label={`Trạng thái đặt bàn ${b.id}`}
                        onChange={(event) => handleBookingStatusChange(b, event.target.value as Booking['status'])}
                      >
                        <option value="confirmed">Đã xác nhận</option>
                        <option value="completed">Hoàn tất</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PRODUCT MODAL */}
      {newProductModal && (
        <div className={styles.overlay} onClick={() => setNewProductModal(false)}>
          <div
            ref={newProductDialogRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-product-title"
            tabIndex={-1}
          >
            <div className={styles.modalHeader}>
              <h3 id="new-product-title">{t('Thêm Sản Phẩm Mới', 'Add New Product')}</h3>
              <button type="button" aria-label={t('Đóng thêm sản phẩm', 'Close add product')} onClick={() => setNewProductModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProduct} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>Tên món đồ uống / bánh *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Coldbrew Cam Sả"
                  value={prodNameVi}
                  onChange={(e) => setProdNameVi(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Giá bán (VND) *</label>
                <input
                  type="number"
                  required
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                <span>Thêm Món Ngay</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
