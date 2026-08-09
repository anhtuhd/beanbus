'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { MapPin, Phone, Clock, Mail, MessageSquare, CheckCircle, Send } from 'lucide-react';
import styles from './contact.module.css';

export default function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
    }, 1000);
  };

  return (
    <div className={styles.contactPage}>
      {/* BANNER */}
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Kết nối với Beanbus', 'Get in Touch')}</span>
          </div>
          <h1 className={styles.title}>{t('Liên Hệ & Ghé Thăm Quán', 'Contact & Visit Us')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Chỉ cần gọi điện, nhắn tin fanpage hoặc điền form — đội ngũ Beanbus luôn sẵn sàng lắng nghe và chuẩn bị sẵn cho bạn.',
              'Just call, message our fanpage or send us a message — Beanbus team is always ready.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className={styles.contactGrid}>
          {/* LEFT: INFO & FORM */}
          <div className={styles.formCol}>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <MapPin className={styles.infoIcon} />
                <div>
                  <h4>{t('Địa chỉ quán & xưởng rang', 'Café & Roastery Address')}</h4>
                  <p>Số 25-27 Thanh Bình, Phường Lê Thanh Nghị, TP. Hải Phòng</p>
                </div>
              </div>

              <div className={styles.infoItem}>
                <Phone className={styles.infoIcon} />
                <div>
                  <h4>{t('Hotline / Zalo đặt đồ & hạt sỉ', 'Hotline / Zalo Order')}</h4>
                  <p><a href="tel:0937936688">0937 936 688</a></p>
                </div>
              </div>

              <div className={styles.infoItem}>
                <Clock className={styles.infoIcon} />
                <div>
                  <h4>{t('Giờ phục vụ', 'Opening Hours')}</h4>
                  <p>07:00 – 23:00 ({t('Mở cửa tất cả các ngày trong tuần', 'Open every day')})</p>
                </div>
              </div>

              <div className={styles.infoItem}>
                <Mail className={styles.infoIcon} />
                <div>
                  <h4>Email</h4>
                  <p>contact@beanbus.vn • b2b@beanbus.vn</p>
                </div>
              </div>
            </div>

            {/* FORM */}
            <div className={styles.formCard}>
              <h3><MessageSquare size={20} className={styles.formIcon} /> {t('Gửi tin nhắn trực tiếp', 'Send Us a Message')}</h3>

              {submitted ? (
                <div className={styles.submittedBox}>
                  <CheckCircle size={44} color="#10b981" />
                  <h4>{t('Cảm ơn bạn đã liên hệ Beanbus!', 'Thank you for reaching out!')}</h4>
                  <p>{t('Chúng tôi đã nhận được thông tin và sẽ phản hồi qua Zalo/Phone trong thời gian sớm nhất.', 'We received your message and will respond shortly.')}</p>
                  <button className="btn btn-dark btn-sm" onClick={() => setSubmitted(false)}>
                    {t('Gửi tin nhắn khác', 'Send another message')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.rowTwo}>
                    <div className={styles.inputGroup}>
                      <label>{t('Họ và tên', 'Your Name')} *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>{t('Số điện thoại', 'Phone Number')} *</label>
                      <input
                        type="tel"
                        required
                        placeholder="0987 xxx xxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Email ({t('Không bắt buộc', 'Optional')})</label>
                    <input
                      type="email"
                      placeholder="email@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('Nội dung nhắn gửi', 'Message')} *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder={t('Nhập thắc mắc, phản hồi hoặc yêu cầu hợp tác...', 'Write your message or inquiry...')}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                    <Send size={18} />
                    <span>{t('Gửi Tin Nhắn Ngay', 'Send Message Now')}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT: MAP */}
          <div className={styles.mapCol}>
            <div className={styles.mapWrap}>
              <iframe
                title="Beanbus Hai Phong Map"
                src="https://www.google.com/maps?q=S%E1%BB%91+25-27+Thanh+B%C3%ACnh%2C+ph%C6%B0%E1%BB%9Dng+L%C3%AA+Thanh+Ngh%E1%BB%8B%2C+H%E1%BA%A3i+Ph%C3%B2ng&output=embed"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
