'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useOrders, type Booking } from '@/context/OrderContext';
import { Calendar, CheckCircle, Sparkles } from 'lucide-react';
import styles from './booking.module.css';

export default function BookingPage() {
  const { t } = useLanguage();
  const { createBooking } = useOrders();

  const [date, setDate] = useState('2026-08-10');
  const [time, setTime] = useState('14:30');
  const [guestCount, setGuestCount] = useState(2);
  const [seatingArea, setSeatingArea] = useState<'indoor' | 'balcony' | 'roastery_bar'>('indoor');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createBooking({
      name: name || 'Nguyễn Văn Bean',
      phone: phone || '0987654321',
      email: undefined,
      date,
      time,
      guestCount,
      seatingArea,
      occasion: 'Gặp gỡ bạn bè',
      note,
    });
    setConfirmedBooking(created);
  };

  const availableTimes = ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00', '19:00', '20:30'];

  return (
    <div className={styles.bookingPage}>
      {/* BANNER */}
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Dịch vụ tại Beanbus', 'Beanbus Services')}</span>
          </div>
          <h1 className={styles.title}>{t('Đặt Bàn Trước Tận Hưởng Không Gian', 'Reserve Your Table')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Giữ chỗ ngồi đẹp nhất tại góc không gian Hải Phòng — chuẩn bị sẵn trải nghiệm cà phê đặc sản cho bạn & người thân.',
              'Secure the best seats in our Hải Phòng café space — prepared especially for you.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        {confirmedBooking ? (
          <div className={styles.successCard}>
            <div className={styles.successIcon}><CheckCircle size={56} color="#10b981" /></div>
            <h2>{t('Đặt Bàn Thành Công!', 'Reservation Confirmed!')}</h2>
            <p className={styles.codeText}>
              {t('Mã đặt bàn của bạn:', 'Reservation Code:')} <strong>{confirmedBooking.id}</strong>
            </p>
            <div className={styles.bookingDetails}>
              <div className={styles.bRow}>
                <span>📅 {t('Ngày & Giờ:', 'Date & Time:')}</span>
                <strong>{confirmedBooking.date} • {confirmedBooking.time}</strong>
              </div>
              <div className={styles.bRow}>
                <span>👥 {t('Số lượng khách:', 'Guests:')}</span>
                <strong>{confirmedBooking.guestCount} {t('người', 'people')}</strong>
              </div>
              <div className={styles.bRow}>
                <span>🪑 {t('Vị trí chọn:', 'Seating:')}</span>
                <strong>
                  {confirmedBooking.seatingArea === 'indoor'
                    ? t('Trong nhà máy lạnh', 'Indoor Aircon')
                    : confirmedBooking.seatingArea === 'balcony'
                    ? t('Ban công view thoáng', 'Balcony View')
                    : t('Quầy Bar Xưởng Rang', 'Roastery Bar')}
                </strong>
              </div>
              <div className={styles.bRow}>
                <span>📍 {t('Địa chỉ:', 'Address:')}</span>
                <strong>25-27 Thanh Bình, Phường Lê Thanh Nghị, TP. Hải Phòng</strong>
              </div>
            </div>

            <p className={styles.reminder}>
              💌 {t('Beanbus sẽ gửi SMS/Zalo xác nhận lại trước 30 phút. Rất hân hạnh được đón tiếp bạn!', 'We will send a confirmation SMS 30 mins prior. Looking forward to welcoming you!')}
            </p>

            <button
              className="btn btn-primary btn-lg"
              onClick={() => setConfirmedBooking(null)}
            >
              {t('Tạo Đặt Bàn Khác', 'Make Another Booking')}
            </button>
          </div>
        ) : (
          <div className={styles.bookingGrid}>
            {/* FORM */}
            <form onSubmit={handleSubmit} className={styles.formCard}>
              <h3 className={styles.formTitle}>
                <Calendar size={20} className={styles.titleIcon} />
                <span>{t('Điền thông tin đặt chỗ', 'Reservation Form')}</span>
              </h3>

              <div className={styles.rowTwo}>
                <div className={styles.inputGroup}>
                  <label>{t('Ngày đặt', 'Date')} *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>{t('Số lượng khách', 'Number of Guests')} *</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                  >
                    <option value={1}>1 {t('người', 'person')}</option>
                    <option value={2}>2 {t('người', 'people')}</option>
                    <option value={4}>4 {t('người', 'people')}</option>
                    <option value={6}>6 {t('người', 'people')}</option>
                    <option value={8}>8 {t('người', 'people')}</option>
                    <option value={10}>10+ {t('người (Nhóm lớn)', 'people (Large group)')}</option>
                  </select>
                </div>
              </div>

              {/* TIME SLOTS */}
              <div className={styles.inputGroup}>
                <label>{t('Chọn khung giờ', 'Select Time Slot')} *</label>
                <div className={styles.timeGrid}>
                  {availableTimes.map((tSlot) => (
                    <button
                      key={tSlot}
                      type="button"
                      className={`${styles.timeBtn} ${time === tSlot ? styles.timeActive : ''}`}
                      onClick={() => setTime(tSlot)}
                    >
                      {tSlot}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEATING PREFERENCE */}
              <div className={styles.inputGroup}>
                <label>{t('Khu vực ngồi yêu thích', 'Seating Preference')}</label>
                <div className={styles.seatingGrid}>
                  <button
                    type="button"
                    className={`${styles.seatBtn} ${seatingArea === 'indoor' ? styles.seatActive : ''}`}
                    onClick={() => setSeatingArea('indoor')}
                  >
                    ❄️ {t('Trong nhà (Máy lạnh)', 'Indoor (AC)')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.seatBtn} ${seatingArea === 'balcony' ? styles.seatActive : ''}`}
                    onClick={() => setSeatingArea('balcony')}
                  >
                    🌿 {t('Ban công (Thoáng mát)', 'Balcony (Outdoor)')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.seatBtn} ${seatingArea === 'roastery_bar' ? styles.seatActive : ''}`}
                    onClick={() => setSeatingArea('roastery_bar')}
                  >
                    ☕ {t('Quầy Bar Xưởng Rang', 'Roastery Bar')}
                  </button>
                </div>
              </div>

              <div className={styles.rowTwo}>
                <div className={styles.inputGroup}>
                  <label>{t('Họ và tên của bạn', 'Full Name')} *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>{t('Số điện thoại liên hệ', 'Phone Number')} *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0987 xxx xxx"
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{t('Dịp đặc biệt / Yêu cầu thêm', 'Special Requests / Occasion')}</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('Ví dụ: Cần bàn gần ổ cắm điện, chuẩn bị ghế trẻ em...', 'e.g. Near power outlet...')}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                <Sparkles size={18} />
                <span>{t('Xác Nhận Đặt Bàn Ngay', 'Confirm Reservation')}</span>
              </button>
            </form>

            {/* INFO PANEL */}
            <div className={styles.sidePanel}>
              <div className={styles.infoCard}>
                <h3>☕ {t('Trải nghiệm tại Beanbus Hải Phòng', 'Beanbus Café Experience')}</h3>
                <ul>
                  <li>
                    <CheckCircle size={16} color="#a9c97e" />
                    <span>{t('Không gian hiện đại, yên tĩnh thích hợp học tập & làm việc', 'Modern, quiet space for work & study')}</span>
                  </li>
                  <li>
                    <CheckCircle size={16} color="#a9c97e" />
                    <span>{t('Phục vụ Espresso Bar, Cold-Brew & Bánh tươi mỗi ngày', 'Espresso Bar, Cold-Brew & fresh pastries daily')}</span>
                  </li>
                  <li>
                    <CheckCircle size={16} color="#a9c97e" />
                    <span>{t('Xem trực tiếp quy trình rang cà phê đặc sản tại xưởng', 'Watch live specialty coffee roasting at our workshop')}</span>
                  </li>
                  <li>
                    <CheckCircle size={16} color="#a9c97e" />
                    <span>{t('Wifi tốc độ cao & ổ cắm điện trang bị tại mọi vị trí', 'High-speed Wi-Fi & power outlets at every seat')}</span>
                  </li>
                </ul>
              </div>

              <div className={styles.contactSide}>
                <h4>📍 {t('Địa chỉ & Hotline', 'Location & Contact')}</h4>
                <p>Số 25-27 Thanh Bình, Phường Lê Thanh Nghị, TP. Hải Phòng</p>
                <p>Hotline: <strong>0937 936 688</strong></p>
                <p>Giờ mở cửa: <strong>07:00 – 23:00 hàng ngày</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
