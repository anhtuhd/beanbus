'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from '@/app/account/account.module.css';

export const OTP_RESEND_SECONDS = 60;

export default function OtpResendButton({
  action,
  intent,
  onResend,
  pending,
}: {
  action: (formData: FormData) => void;
  intent?: 'phone_change';
  onResend: () => void;
  pending: boolean;
}) {
  const { t } = useLanguage();
  const [seconds, setSeconds] = useState(OTP_RESEND_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return value - 1;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <button
      type="submit"
      name={intent ? 'otpIntent' : undefined}
      value={intent}
      formAction={action}
      formNoValidate
      onClick={onResend}
      className={styles.resendButton}
      disabled={pending || seconds > 0}
    >
      {seconds > 0
        ? t(`Gửi lại sau ${seconds}s`, `Resend in ${seconds}s`)
        : t('Gửi lại mã qua Zalo', 'Resend via Zalo')}
    </button>
  );
}
