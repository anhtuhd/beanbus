'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Award, LogIn } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  requestPhoneOtp,
  signInWithGoogle,
  verifyPhoneOtp,
} from '@/app/auth/actions';
import { initialPhoneAuthState } from '@/app/auth/phone-state';
import OtpResendButton from '@/app/auth/OtpResendButton';
import TurnstileWidget from './TurnstileWidget';
import styles from '@/app/account/account.module.css';

type LoginFormProps = {
  errorMessage?: string;
  googleEnabled: boolean;
  next: string;
  phoneEnabled: boolean;
  turnstileSiteKey?: string;
};

export default function LoginForm({
  errorMessage,
  googleEnabled,
  next,
  phoneEnabled,
  turnstileSiteKey,
}: LoginFormProps) {
  const { t } = useLanguage();
  const [requestState, requestAction, requestPending] = useActionState(
    requestPhoneOtp,
    initialPhoneAuthState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyPhoneOtp,
    initialPhoneAuthState
  );
  const [activeAction, setActiveAction] = useState<'request' | 'verify'>('request');
  const codeSent = requestState.status === 'code-sent' && requestState.phone;
  const currentError = (activeAction === 'verify' ? verifyState.message : requestState.message) ?? errorMessage;

  return (
    <div className={`wrap ${styles.loginPage}`}>
      <div className={styles.loginCard}>
        <div className={styles.logoHeader}>
          <Award size={36} className={styles.goldIcon} />
          <h1>{t('Hội Viên Beanbus Coffee', 'Beanbus Member Club')}</h1>
          <p>
            {t(
              'Đăng nhập để quản lý hồ sơ và theo dõi hoạt động thành viên.',
              'Sign in to manage your profile and membership activity.'
            )}
          </p>
        </div>

        {currentError && (
          <p className={styles.authStatus} role="alert">{currentError}</p>
        )}

        {!codeSent ? (
          <form action={requestAction} className={styles.loginForm}>
            <input type="hidden" name="next" value={next} />
            <div className={styles.inputGroup}>
              <label htmlFor="phone">{t('Số điện thoại', 'Phone number')}</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                disabled={!phoneEnabled || requestPending}
                placeholder="0987 654 321"
              />
            </div>
            {phoneEnabled && turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} />}
            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles.fullButton}`}
              disabled={!phoneEnabled || requestPending}
            >
              {requestPending ? t('Đang gửi...', 'Sending...') : t('Nhận mã qua Zalo', 'Get code via Zalo')}
            </button>
            {!phoneEnabled && (
              <p className={styles.authHint}>{t('Đăng nhập qua Zalo chưa khả dụng.', 'Zalo sign-in is unavailable.')}</p>
            )}
          </form>
        ) : (
          <form action={verifyAction} className={styles.loginForm}>
            <input type="hidden" name="phone" value={requestState.phone} />
            <input type="hidden" name="next" value={next} />
            <div className={styles.inputGroup}>
              <label htmlFor="token">{t('Mã OTP gồm 6 số', '6-digit OTP')}</label>
              <input
                id="token"
                name="token"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                disabled={verifyPending}
              />
            </div>
            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles.fullButton}`}
              disabled={verifyPending}
              onClick={() => setActiveAction('verify')}
            >
              {verifyPending ? t('Đang xác thực...', 'Verifying...') : t('Xác nhận OTP', 'Verify OTP')}
            </button>
            {turnstileSiteKey && (
              <TurnstileWidget key={requestState.requestId} siteKey={turnstileSiteKey} />
            )}
            <OtpResendButton
              key={requestState.requestId}
              action={requestAction}
              onResend={() => setActiveAction('request')}
              pending={requestPending}
            />
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.authReset}>
              {t('Dùng số điện thoại khác', 'Use another phone number')}
            </Link>
          </form>
        )}

        <div className={styles.divider}><span>{t('Hoặc', 'Or')}</span></div>

        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className={`${styles.googleBtn} ${styles.fullButton}`} disabled={!googleEnabled}>
            <LogIn size={20} aria-hidden="true" />
            <span>{t('Tiếp tục với Google', 'Continue with Google')}</span>
          </button>
        </form>
        {!googleEnabled && (
          <p className={styles.authHint}>{t('Đăng nhập Google chưa khả dụng.', 'Google sign-in is unavailable.')}</p>
        )}
      </div>
    </div>
  );
}
