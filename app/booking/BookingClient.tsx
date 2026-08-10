'use client';

import React, { useRef, useState } from 'react';
import { createProductionBooking } from './actions';
import { useLanguage } from '@/context/LanguageContext';
import { withSupportReference } from '@/lib/observability/support-reference';
import { useOrders } from '@/context/OrderContext';
import { Armchair, Calendar, CalendarDays, CheckCircle, Coffee, LoaderCircle, MapPin, Snowflake, Sparkles, Trees, Users } from 'lucide-react';
import styles from './booking.module.css';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';

type BookingReceipt = {
  date: string;
  guestCount: number;
  id: string;
  seatingArea: 'indoor' | 'balcony' | 'roastery_bar';
  status: 'pending' | 'confirmed';
  time: string;
};

export default function BookingPage() {
  const { t } = useLanguage();
  const { createBooking } = useOrders();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:30');
  const [guestCount, setGuestCount] = useState(2);
  const [seatingArea, setSeatingArea] = useState<'indoor' | 'balcony' | 'roastery_bar'>('indoor');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [consentToContact, setConsentToContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const idempotencyKey = useRef<string | null>(null);

  const [confirmedBooking, setConfirmedBooking] = useState<BookingReceipt | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');

    if (isProduction) {
      setIsSubmitting(true);
      idempotencyKey.current ??= crypto.randomUUID();
      try {
        const result = await createProductionBooking({
          idempotencyKey: idempotencyKey.current,
          name,
          phone,
          date,
          time,
          guestCount,
          seatingArea,
          note,
          consentToContact,
        });
        if (!result.ok) {
          setSubmitError(withSupportReference(
            t('Thông tin chưa hợp lệ hoặc chưa thể gửi yêu cầu. Vui lòng kiểm tra và thử lại.', 'Please check your details and try again.'),
            result.reference,
            t('Mã hỗ trợ', 'Support reference')
          ));
          return;
        }
        setConfirmedBooking({
          id: result.booking.reference,
          date,
          time,
          guestCount,
          seatingArea,
          status: 'pending',
        });
      } catch {
        setSubmitError(t('Kết nối bị gián đoạn. Vui lòng thử lại.', 'Connection interrupted. Please try again.'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
    setConfirmedBooking({
      id: created.id,
      date: created.date,
      time: created.time,
      guestCount: created.guestCount,
      seatingArea: created.seatingArea,
      status: 'confirmed',
    });
  };

  const startAnotherBooking = () => {
    idempotencyKey.current = null;
    setConfirmedBooking(null);
    setSubmitError('');
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
            <h2>
              {confirmedBooking.status === 'pending'
                ? t('Đã nhận yêu cầu đặt bàn', 'Reservation Request Received')
                : t('Đặt bàn thành công!', 'Reservation Confirmed!')}
            </h2>
            <p className={styles.codeText}>
              {t('Mã yêu cầu:', 'Request reference:')} <strong>{confirmedBooking.id}</strong>
            </p>
            {confirmedBooking.status === 'pending' && (
              <div className={styles.pendingBadge}>{t('Đang chờ xác nhận', 'Pending confirmation')}</div>
            )}
            <div className={styles.bookingDetails}>
              <div className={styles.bRow}>
                <span><CalendarDays size={16} /> {t('Ngày & Giờ:', 'Date & Time:')}</span>
                <strong>{confirmedBooking.date} • {confirmedBooking.time}</strong>
              </div>
              <div className={styles.bRow}>
                <span><Users size={16} /> {t('Số lượng khách:', 'Guests:')}</span>
                <strong>{confirmedBooking.guestCount} {t('người', 'people')}</strong>
              </div>
              <div className={styles.bRow}>
                <span><Armchair size={16} /> {t('Vị trí chọn:', 'Seating:')}</span>
                <strong>
                  {confirmedBooking.seatingArea === 'indoor'
                    ? t('Trong nhà máy lạnh', 'Indoor Aircon')
                    : confirmedBooking.seatingArea === 'balcony'
                    ? t('Ban công view thoáng', 'Balcony View')
                    : t('Quầy Bar Xưởng Rang', 'Roastery Bar')}
                </strong>
              </div>
              <div className={styles.bRow}>
                <span><MapPin size={16} /> {t('Địa chỉ:', 'Address:')}</span>
                <strong>25-27 Thanh Bình, Phường Lê Thanh Nghị, TP. Hải Phòng</strong>
              </div>
            </div>

            <p className={styles.reminder}>
              {t('Beanbus đã lưu yêu cầu. Nhân viên sẽ liên hệ theo thông tin bạn cung cấp sau khi kiểm tra chỗ ngồi.', 'Beanbus saved your request. A team member will contact you after checking availability.')}
            </p>

            <button
              className="btn btn-primary btn-lg"
              onClick={startAnotherBooking}
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
                  <label htmlFor="booking-date">{t('Ngày đặt', 'Date')} *</label>
                  <input
                    id="booking-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="booking-guests">{t('Số lượng khách', 'Number of Guests')} *</label>
                  <select
                    id="booking-guests"
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
                      aria-pressed={time === tSlot}
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
                    aria-pressed={seatingArea === 'indoor'}
                  >
                    <Snowflake size={16} /> {t('Trong nhà (Máy lạnh)', 'Indoor (AC)')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.seatBtn} ${seatingArea === 'balcony' ? styles.seatActive : ''}`}
                    onClick={() => setSeatingArea('balcony')}
                    aria-pressed={seatingArea === 'balcony'}
                  >
                    <Trees size={16} /> {t('Ban công (Thoáng mát)', 'Balcony (Outdoor)')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.seatBtn} ${seatingArea === 'roastery_bar' ? styles.seatActive : ''}`}
                    onClick={() => setSeatingArea('roastery_bar')}
                    aria-pressed={seatingArea === 'roastery_bar'}
                  >
                    <Coffee size={16} /> {t('Quầy Bar Xưởng Rang', 'Roastery Bar')}
                  </button>
                </div>
              </div>

              <div className={styles.rowTwo}>
                <div className={styles.inputGroup}>
                  <label htmlFor="booking-name">{t('Họ và tên của bạn', 'Full Name')} *</label>
                  <input
                    id="booking-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="booking-phone">{t('Số điện thoại liên hệ', 'Phone Number')} *</label>
                  <input
                    id="booking-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0987 xxx xxx"
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="booking-note">{t('Dịp đặc biệt / Yêu cầu thêm', 'Special Requests / Occasion')}</label>
                <input
                  id="booking-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('Ví dụ: Cần bàn gần ổ cắm điện, chuẩn bị ghế trẻ em...', 'e.g. Near power outlet...')}
                />
              </div>

              <label className={styles.consentRow}>
                <input
                  type="checkbox"
                  checked={consentToContact}
                  onChange={(event) => setConsentToContact(event.target.checked)}
                  required
                />
                <span>{t('Tôi đồng ý để Beanbus liên hệ về yêu cầu đặt bàn này.', 'I agree that Beanbus may contact me about this reservation request.')}</span>
              </label>

              {submitError && <p className={styles.submitError} role="alert">{submitError}</p>}

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle size={18} className={styles.spinner} /> : <Sparkles size={18} />}
                <span>{isSubmitting ? t('Đang gửi yêu cầu...', 'Sending request...') : t('Gửi Yêu Cầu Đặt Bàn', 'Send Reservation Request')}</span>
              </button>
            </form>

            {/* INFO PANEL */}
            <div className={styles.sidePanel}>
              <div className={styles.infoCard}>
                <h3><Coffee size={18} /> {t('Trải nghiệm tại Beanbus Hải Phòng', 'Beanbus Café Experience')}</h3>
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
                <h4><MapPin size={18} /> {t('Địa chỉ & Hotline', 'Location & Contact')}</h4>
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
