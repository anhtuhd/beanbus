'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { redeemMemberReward } from './redeem-actions';
import { initialRedeemState } from './redeem-state';
import styles from './account.module.css';

export default function RewardRedeemForm({ rewardId, disabled }: { rewardId: string; disabled: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [state, action, pending] = useActionState(redeemMemberReward, initialRedeemState);
  const processedVoucher = useRef<string | null>(null);
  const idempotencyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status !== 'success' || !state.voucherCode || processedVoucher.current === state.voucherCode) return;
    processedVoucher.current = state.voucherCode;
    router.refresh();
  }, [router, state]);

  const handleSubmit = () => {
    if (idempotencyInput.current) idempotencyInput.current.value = crypto.randomUUID();
  };

  return (
    <>
      {state.status !== 'idle' && <div className={state.status === 'error' ? styles.accountStatus : styles.successAlert} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</div>}
      <form action={action} onSubmit={handleSubmit}>
        <input type="hidden" name="rewardId" value={rewardId} />
        <input ref={idempotencyInput} type="hidden" name="idempotencyKey" defaultValue="" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
          {pending ? t('Đang xử lý...', 'Processing...') : t('Đổi voucher', 'Redeem voucher')}
        </button>
      </form>
    </>
  );
}
