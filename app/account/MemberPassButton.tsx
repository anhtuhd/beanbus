'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { LoaderCircle, QrCode, X } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import styles from './account.module.css';

export default function MemberPassButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const { lang, t } = useLanguage();
  const dialogRef = useDialogFocus<HTMLElement>(open, () => setOpen(false));

  async function showPass(force = false) {
    setOpen(true);
    setError('');
    const hasValidPass = image && expiresAt && Date.parse(expiresAt) > Date.now();
    if (hasValidPass && !force) return;
    setImage('');
    setExpiresAt('');
    setLoading(true);
    try {
      const response = await fetch('/api/account/member-pass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const payload = await response.json() as { token?: string; expiresAt?: string; error?: { message?: string } };
      if (!response.ok || !payload.token || !payload.expiresAt) throw new Error(payload.error?.message ?? t('Không thể tạo mã hội viên.', 'Unable to create a member pass.'));
      setImage(await QRCode.toDataURL(payload.token, { width: 280, margin: 2, errorCorrectionLevel: 'M' }));
      setExpiresAt(payload.expiresAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Không thể tạo mã hội viên.', 'Unable to create a member pass.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.memberPassButton} onClick={() => void showPass()}>
        <QrCode size={16} aria-hidden="true" /> <span>{label}</span>
      </button>
      {open && (
        <div className={styles.memberPassOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialogRef} className={styles.memberPassDialog} role="dialog" aria-modal="true" aria-labelledby="member-pass-title" tabIndex={-1}>
            <button type="button" className={styles.memberPassClose} onClick={() => setOpen(false)} aria-label={t('Đóng', 'Close')}><X size={20} /></button>
            <h2 id="member-pass-title">{t('Mã hội viên tại quầy', 'In-store member pass')}</h2>
            <p>{t('Đưa mã này cho nhân viên quét. Mã tự hết hạn sau 5 phút và chỉ dùng một lần.', 'Show this code for staff to scan. It expires after five minutes and can be used once.')}</p>
            {loading && <LoaderCircle className={styles.spinner} aria-label={t('Đang tạo mã', 'Creating pass')} />}
            {error && <p className={styles.accountStatus} role="alert">{error}</p>}
            {image && !loading && <Image src={image} alt={t('Mã QR hội viên', 'Member QR code')} className={styles.memberPassQr} width={280} height={280} unoptimized />}
            {expiresAt && <time dateTime={expiresAt}>{t('Hết hạn lúc', 'Expires at')} {new Date(expiresAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'vi-VN')}</time>}
            {image && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void showPass(true)}>{t('Tạo mã mới', 'Create a new code')}</button>}
          </section>
        </div>
      )}
    </>
  );
}
