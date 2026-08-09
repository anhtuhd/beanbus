'use client';

import { useRef, useState } from 'react';
import { Calendar, CheckCircle, LoaderCircle, MapPin, Sparkles, X } from 'lucide-react';
import { createCustomerRequest } from '@/app/request-actions';
import { useLanguage } from '@/context/LanguageContext';
import type { EventItem } from '@/data/events';
import { withSupportReference } from '@/lib/observability/support-reference';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import styles from './events.module.css';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';

export default function RsvpButton({ event }: { event: EventItem }) {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const idempotencyKey = useRef<string | null>(null);

  const open = () => {
    idempotencyKey.current = null;
    setName('');
    setPhone('');
    setConsent(false);
    setError('');
    setReference('');
    setIsOpen(true);
  };

  const close = () => {
    if (!isSubmitting) setIsOpen(false);
  };
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen, close);

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!isProduction) {
      setReference(`EV-DEMO-${Date.now().toString().slice(-6)}`);
      return;
    }

    setIsSubmitting(true);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const result = await createCustomerRequest({
        type: 'rsvp',
        idempotencyKey: idempotencyKey.current,
        name,
        phone,
        subjectReference: event.id,
        consentToContact: consent,
      });
      if (result.ok) setReference(result.request.reference);
      else setError(withSupportReference(
        t('Thông tin chưa hợp lệ hoặc chưa thể gửi. Vui lòng kiểm tra và thử lại.', 'Please check your details and try again.'),
        result.reference,
        t('Mã hỗ trợ', 'Support reference')
      ));
    } catch {
      setError(t('Kết nối bị gián đoạn. Vui lòng thử lại.', 'Connection interrupted. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={open}>
        {t('Yêu Cầu Tham Gia', 'Request RSVP')}
      </button>
      {isOpen && (
        <div className={styles.overlay} onClick={close}>
          <div ref={dialogRef} className={styles.modal} onClick={(clickEvent) => clickEvent.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={`rsvp-title-${event.id}`} tabIndex={-1}>
            <div className={styles.modalHeader}>
              <h3 id={`rsvp-title-${event.id}`}>{t('Yêu Cầu Tham Gia Sự Kiện', 'Event RSVP Request')}</h3>
              <button onClick={close} aria-label={t('Đóng', 'Close')} disabled={isSubmitting}><X size={20} /></button>
            </div>

            {reference ? (
              <div className={styles.successState}>
                <CheckCircle size={52} color="#10b981" />
                <h3>{t('Đã nhận yêu cầu tham gia', 'RSVP Request Received')}</h3>
                <p className={styles.reference}>{t('Mã yêu cầu:', 'Request reference:')} <strong>{reference}</strong></p>
                <p>{t('Beanbus đã lưu thông tin. Nhân viên sẽ liên hệ sau khi kiểm tra tình trạng chỗ.', 'Beanbus saved your request. A team member will contact you after checking availability.')}</p>
                <button className="btn btn-dark btn-sm" onClick={close}>{t('Đóng', 'Close')}</button>
              </div>
            ) : (
              <form onSubmit={submit} className={styles.rsvpForm}>
                <div className={styles.eventInfoBox}>
                  <h4>{lang === 'en' ? event.titleEn : event.titleVi}</h4>
                  <p><Calendar size={14} /> {event.date} ({event.time})</p>
                  <p><MapPin size={14} /> {event.location}</p>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor={`rsvp-name-${event.id}`}>{t('Họ và tên của bạn', 'Your Full Name')} *</label>
                  <input id={`rsvp-name-${event.id}`} required maxLength={100} value={name} onChange={(changeEvent) => setName(changeEvent.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor={`rsvp-phone-${event.id}`}>{t('Số điện thoại liên hệ', 'Phone Number')} *</label>
                  <input id={`rsvp-phone-${event.id}`} type="tel" required maxLength={20} value={phone} onChange={(changeEvent) => setPhone(changeEvent.target.value)} />
                </div>
                <label className={styles.consentRow}>
                  <input type="checkbox" checked={consent} onChange={(changeEvent) => setConsent(changeEvent.target.checked)} required />
                  <span>{t('Tôi đồng ý để Beanbus liên hệ về sự kiện này.', 'I agree that Beanbus may contact me about this event.')}</span>
                </label>
                {error && <p className={styles.submitError} role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle size={18} className={styles.spinner} /> : <Sparkles size={18} />}
                  <span>{isSubmitting ? t('Đang gửi...', 'Sending...') : t('Gửi Yêu Cầu Tham Gia', 'Send RSVP Request')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
