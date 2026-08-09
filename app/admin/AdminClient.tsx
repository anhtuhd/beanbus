'use client';

import React, { useState } from 'react';
import { useOrders, OrderStatus } from '@/context/OrderContext';
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
} from 'lucide-react';
import styles from './admin.module.css';

export default function AdminClient() {
  const { orders, updateOrderStatus, bookings } = useOrders();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'members' | 'bookings'>('orders');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  // Menu state simulation
  const [menuList, setMenuList] = useState<Product[]>(PRODUCTS);
  const [newProductModal, setNewProductModal] = useState(false);
  const [prodNameVi, setProdNameVi] = useState('');
  const [prodPrice, setProdPrice] = useState('40000');

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
        <span className={styles.domainTag}>🌐 beanbus.vn Portal</span>
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
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📦 {t('Quản lý Đơn hàng', 'Order Management')} ({orders.length})
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'menu' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍵 {t('Quản lý Thực đơn Menu', 'Menu Items')} ({menuList.length})
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'bookings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          📅 {t('Quản lý Đặt bàn', 'Bookings')} ({bookings.length})
        </button>
      </div>

      {/* TAB 1: ORDER MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className={styles.tabSection}>
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
        <div className={styles.tabSection}>
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
                    <td><img src={item.image} alt="" className={styles.tableImg} /></td>
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
        <div className={styles.tabSection}>
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
                      <span className={`${styles.badge} ${styles.bgPaid}`}>
                        {b.status.toUpperCase()}
                      </span>
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
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{t('Thêm Sản Phẩm Mới', 'Add New Product')}</h3>
              <button onClick={() => setNewProductModal(false)}><X size={20} /></button>
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
