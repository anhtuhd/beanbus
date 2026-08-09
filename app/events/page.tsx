'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { EVENTS, EventItem } from '@/data/events';
import { Calendar, Clock, MapPin, Users, CheckCircle, Sparkles, X } from 'lucide-react';
import styles from './events.module.css';

export default function EventsPage() {
  const { t, lang } = useLanguage();
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpPhone, setRsvpPhone] = useState('');
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);

  const handleRsvpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRsvpSubmitted(true);
    setTimeout(() => {
      setRsvpSubmitted(false);
      setSelectedEvent(null);
    }, 2200);
  };

  return (
    <div className={styles.eventsPage}>
      {/* BANNER */}
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Cộng đồng Beanbus', 'Beanbus Community')}</span>
          </div>
          <h1 className={styles.title}>{t('Sự Kiện & Workshop Cà Phê', 'Coffee Events & Workshops')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Nơi kết nối đam mê cà phê đặc sản tại Hải Phòng — Cupping workshop, đêm nhạc acoustic và giải đấu Barista.',
              'Connecting specialty coffee lovers in Hải Phòng through workshops, acoustic nights, and barista contests.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className={styles.eventsGrid}>
          {EVENTS.map((item) => (
            <div key={item.id} className={styles.eventCard}>
              <div className={styles.imgBox}>
                <img src={item.image} alt={item.titleVi} className={styles.cardImg} />
                {item.isFeatured && (
                  <span className={styles.featuredBadge}>⭐ Featured Event</span>
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.metaRow}>
                  <span className={styles.metaItem}><Calendar size={14} /> {item.date}</span>
                  <span className={styles.metaItem}><Clock size={14} /> {item.time}</span>
                </div>

                <h3 className={styles.eventTitle}>
                  {lang === 'en' ? item.titleEn : item.titleVi}
                </h3>

                <p className={styles.eventDesc}>
                  {lang === 'en' ? item.summaryEn : item.summaryVi}
                </p>

                <div className={styles.location}>
                  <MapPin size={15} className={styles.locIcon} />
                  <span>{item.location}</span>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.seatInfo}>
                    <Users size={15} />
                    <span>{item.registeredSeats} / {item.maxSeats} {t('chỗ đã đăng ký', 'seats registered')}</span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedEvent(item);
                      setRsvpSubmitted(false);
                    }}
                  >
                    {t('Đăng Ký Tham Gia', 'Register RSVP')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RSVP MODAL */}
      {selectedEvent && (
        <div className={styles.overlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{t('Đăng Ký Sự Kiện', 'Event RSVP')}</h3>
              <button onClick={() => setSelectedEvent(null)}><X size={20} /></button>
            </div>

            {rsvpSubmitted ? (
              <div className={styles.successState}>
                <CheckCircle size={52} color="#10b981" />
                <h3>{t('Đăng Ký Thành Công!', 'RSVP Confirmed!')}</h3>
                <p>{t('Ban tổ chức Beanbus đã ghi nhận thông tin và sẽ gửi xác nhận qua Zalo/SMS cho bạn.', 'Beanbus team has reserved your seat.')}</p>
              </div>
            ) : (
              <form onSubmit={handleRsvpSubmit} className={styles.rsvpForm}>
                <div className={styles.eventInfoBox}>
                  <h4>{lang === 'en' ? selectedEvent.titleEn : selectedEvent.titleVi}</h4>
                  <p>📅 {selectedEvent.date} ({selectedEvent.time})</p>
                  <p>📍 {selectedEvent.location}</p>
                </div>

                <div className={styles.inputGroup}>
                  <label>{t('Họ và tên của bạn', 'Your Full Name')} *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={rsvpName}
                    onChange={(e) => setRsvpName(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>{t('Số điện thoại / Zalo', 'Phone Number / Zalo')} *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0987 xxx xxx"
                    value={rsvpPhone}
                    onChange={(e) => setRsvpPhone(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                  <span>{t('Xác Nhận Giữ Chỗ Miễn Phí', 'Confirm Free RSVP')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
