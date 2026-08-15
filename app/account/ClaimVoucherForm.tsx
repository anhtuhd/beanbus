'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Ticket } from 'lucide-react';
import { claimMemberVoucher } from './voucher-wallet-actions';
import { useLanguage } from '@/context/LanguageContext';
import styles from './account.module.css';

export default function ClaimVoucherForm() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  async function submit() {
    setBusy(true); setMessage(''); setSuccess(false);
    const result = await claimMemberVoucher(code);
    setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    setSuccess(true); setMessage(result.claimed ? t('Đã thêm voucher vào ví của bạn.', 'Voucher added to your wallet.') : t('Voucher này đã có trong ví của bạn.', 'This voucher is already in your wallet.')); setCode('');
  }

  return <section className={styles.voucherClaim} aria-labelledby="claim-voucher-title">
    <div><h3 id="claim-voucher-title"><Ticket size={17} /> {t('Nhập mã voucher', 'Enter voucher code')}</h3><p>{t('Voucher hợp lệ sẽ được thêm vào ví và dùng ở lần thanh toán sau.', 'A valid voucher is added to your wallet for a future checkout.')}</p></div>
    <div className={styles.voucherClaimRow}><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={64} placeholder={t('Nhập mã voucher', 'Enter voucher code')} aria-label={t('Mã voucher', 'Voucher code')} /><button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy || !code.trim()}>{busy ? <LoaderCircle className={styles.spinner} size={15} /> : <Check size={15} />} {t('Lấy voucher', 'Claim voucher')}</button></div>
    {message && <p className={success ? styles.formSuccess : styles.accountStatus} role={success ? 'status' : 'alert'}>{message}</p>}
  </section>;
}
