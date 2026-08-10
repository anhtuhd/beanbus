'use client';

import { useActionState, useEffect, useState } from 'react';
import { BadgeCheck, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { requestMemberPhoneOtp, verifyMemberPhoneOtp } from './actions';
import { initialMemberPhoneState } from './phone-state';
import OtpResendButton from '@/app/auth/OtpResendButton';
import { useLanguage } from '@/context/LanguageContext';
import styles from './account.module.css';

export default function PhoneVerificationPanel({
  currentPhone,
  enabled,
}: {
  currentPhone: string;
  enabled: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [requestState, requestAction, requestPending] = useActionState(
    requestMemberPhoneOtp,
    initialMemberPhoneState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyMemberPhoneOtp,
    initialMemberPhoneState
  );
  const [activeAction, setActiveAction] = useState<'request' | 'verify'>('request');
  const codeSent = requestState.status === 'code-sent' && Boolean(requestState.phone);

  useEffect(() => {
    if (verifyState.status === 'success') router.refresh();
  }, [router, verifyState.status]);

  const state = activeAction === 'verify' ? verifyState : requestState;

  return (
    <section className={styles.phoneVerification} aria-labelledby="phone-verification-title">
      <div className={styles.phoneVerificationHeader}>
        <div>
          <h3 id="phone-verification-title">{t('Số điện thoại hội viên', 'Member phone')}</h3>
          <p>{currentPhone || t('Chưa có số điện thoại đã xác minh', 'No verified phone number')}</p>
        </div>
        {currentPhone && (
          <span className={styles.verifiedBadge}>
            <BadgeCheck size={16} /> {t('Đã xác minh', 'Verified')}
          </span>
        )}
      </div>

      {!codeSent ? (
        <form action={requestAction} className={styles.phoneVerificationForm}>
          <label>
            {currentPhone ? t('Số điện thoại mới', 'New phone number') : t('Số điện thoại', 'Phone number')}
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0987 654 321"
              required
              disabled={!enabled || requestPending}
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!enabled || requestPending}>
            <MessageCircle size={16} />
            {requestPending ? t('Đang gửi...', 'Sending...') : t('Nhận mã qua Zalo', 'Get code via Zalo')}
          </button>
        </form>
      ) : (
        <form action={verifyAction} className={styles.phoneVerificationForm}>
          <input type="hidden" name="phone" value={requestState.phone} />
          <label>
            {t('Mã xác thực gồm 6 số', '6-digit verification code')}
            <input
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={verifyPending}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={verifyPending}
            onClick={() => setActiveAction('verify')}
          >
            {verifyPending ? t('Đang xác minh...', 'Verifying...') : t('Xác minh số', 'Verify phone')}
          </button>
          <OtpResendButton
            key={requestState.requestId}
            action={requestAction}
            intent="phone_change"
            onResend={() => setActiveAction('request')}
            pending={requestPending}
          />
        </form>
      )}

      {!enabled && (
        <p className={styles.authHint}>{t('Xác minh số qua Zalo chưa khả dụng.', 'Zalo verification is unavailable.')}</p>
      )}
      {state.status !== 'idle' && state.message && (
        <p
          className={state.status === 'error' ? styles.formError : styles.formSuccess}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
