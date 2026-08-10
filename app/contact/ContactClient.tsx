'use client';

import React, { useRef, useState } from 'react';
import { createCustomerRequest } from '@/app/request-actions';
import { useLanguage } from '@/context/LanguageContext';
import { withSupportReference } from '@/lib/observability/support-reference';
import { MapPin, Phone, Clock, Mail, MessageSquare, CheckCircle, LoaderCircle, Send } from 'lucide-react';
import styles from './contact.module.css';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';

export default function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consentToContact, setConsentToContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');

    if (isProduction) {
      setIsSubmitting(true);
      idempotencyKey.current ??= crypto.randomUUID();
      try {
        const result = await createCustomerRequest({
          type: 'contact',
          idempotencyKey: idempotencyKey.current,
          name,
          phone,
          email,
          message,
          consentToContact,
        });
        if (!result.ok) {
          setSubmitError(withSupportReference(
            t('Thông tin chưa hợp lệ hoặc chưa thể gửi. Vui lòng kiểm tra và thử lại.', 'Please check your details and try again.'),
            result.reference,
            t('Mã hỗ trợ', 'Support reference')
          ));
          return;
        }
        setReference(result.request.reference);
        setSubmitted(true);
      } catch {
        setSubmitError(t('Kết nối bị gián đoạn. Vui lòng thử lại.', 'Connection interrupted. Please try again.'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setReference(`CT-DEMO-${Date.now().toString().slice(-6)}`);
    setSubmitted(true);
  };

  const startAnotherMessage = () => {
    idempotencyKey.current = null;
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setConsentToContact(false);
    setSubmitError('');
    setReference('');
    setSubmitted(false);
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
                  <h4>{t('Beanbus đã nhận yêu cầu liên hệ', 'Contact Request Received')}</h4>
                  <p className={styles.reference}>{t('Mã yêu cầu:', 'Request reference:')} <strong>{reference}</strong></p>
                  <p>{t('Thông tin đã được lưu. Nhân viên sẽ liên hệ theo thông tin bạn đồng ý cung cấp sau khi xem nội dung.', 'Your request was saved. A team member will contact you after reviewing it.')}</p>
                  <button className="btn btn-dark btn-sm" onClick={startAnotherMessage}>
                    {t('Gửi tin nhắn khác', 'Send another message')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.rowTwo}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="contact-name">{t('Họ và tên', 'Your Name')} *</label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label htmlFor="contact-phone">{t('Số điện thoại', 'Phone Number')} *</label>
                      <input
                        id="contact-phone"
                        type="tel"
                        required
                        placeholder="0987 xxx xxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="contact-email">Email ({t('Không bắt buộc', 'Optional')})</label>
                    <input
                      id="contact-email"
                      type="email"
                      placeholder="email@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="contact-message">{t('Nội dung nhắn gửi', 'Message')} *</label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      minLength={10}
                      maxLength={2000}
                      placeholder={t('Nhập thắc mắc, phản hồi hoặc yêu cầu hợp tác...', 'Write your message or inquiry...')}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    ></textarea>
                  </div>

                  <label className={styles.consentRow}>
                    <input
                      type="checkbox"
                      checked={consentToContact}
                      onChange={(event) => setConsentToContact(event.target.checked)}
                      required
                    />
                    <span>{t('Tôi đồng ý để Beanbus liên hệ về nội dung này.', 'I agree that Beanbus may contact me about this request.')}</span>
                  </label>

                  {submitError && <p className={styles.submitError} role="alert">{submitError}</p>}

                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
                    {isSubmitting ? <LoaderCircle size={18} className={styles.spinner} /> : <Send size={18} />}
                    <span>{isSubmitting ? t('Đang gửi...', 'Sending...') : t('Gửi Tin Nhắn', 'Send Message')}</span>
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
