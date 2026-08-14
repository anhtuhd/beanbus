'use client';

import { useActionState, useRef, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Minus, Plus } from 'lucide-react';
import { adjustMemberPoints, type MemberPointsAdjustmentState } from './actions';
import styles from '../../requests/requests.module.css';

const initialState: MemberPointsAdjustmentState = { status: 'idle', message: '' };
type Direction = 'add' | 'subtract';

export default function MemberPointsAdjustmentForm({ userId, balancePoints }: { userId: string; balancePoints: number }) {
  const [state, formAction, pending] = useActionState(adjustMemberPoints, initialState);
  const [direction, setDirection] = useState<Direction>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const idempotencyKeyInputRef = useRef<HTMLInputElement>(null);
  const parsedAmount = Number(amount);
  const hasValidAmount = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 10_000_000;
  const availablePoints = Math.max(0, balancePoints);
  const insufficientPoints = direction === 'subtract' && hasValidAmount && parsedAmount > availablePoints;
  const previewBalance = hasValidAmount
    ? balancePoints + (direction === 'subtract' ? -parsedAmount : parsedAmount)
    : balancePoints;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const keyInput = idempotencyKeyInputRef.current;
    if (keyInput && (state.status === 'success' || !keyInput.value)) keyInput.value = crypto.randomUUID();
    if (insufficientPoints) {
      event.preventDefault();
      return;
    }
    const actionLabel = direction === 'add' ? 'cộng' : 'trừ';
    const amountLabel = hasValidAmount ? ` ${parsedAmount.toLocaleString('vi-VN')} điểm` : '';
    if (!window.confirm(`Xác nhận ${actionLabel}${amountLabel} cho hội viên này?`)) event.preventDefault();
  }

  return (
    <form action={formAction} className={styles.productEditor} onSubmit={handleSubmit}>
      <input type="hidden" name="userId" value={userId} />
      <input ref={idempotencyKeyInputRef} type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="direction" value={direction} />

      <div className={styles.adjustmentDirections} role="group" aria-label="Loại điều chỉnh điểm">
        <button
          type="button"
          className={`${styles.adjustmentDirection} ${direction === 'add' ? styles.adjustmentDirectionActive : ''}`}
          aria-pressed={direction === 'add'}
          onClick={() => setDirection('add')}
          disabled={pending}
        >
          <Plus size={16} aria-hidden="true" />
          <span>Cộng điểm</span>
        </button>
        <button
          type="button"
          className={`${styles.adjustmentDirection} ${direction === 'subtract' ? styles.adjustmentDirectionActive : ''}`}
          aria-pressed={direction === 'subtract'}
          onClick={() => setDirection('subtract')}
          disabled={pending}
        >
          <Minus size={16} aria-hidden="true" />
          <span>Trừ điểm</span>
        </button>
      </div>

      <div className={styles.editorGrid}>
        <label htmlFor="points-adjustment-amount">
          Điểm điều chỉnh
          <input
            id="points-adjustment-amount"
            name="amount"
            type="number"
            min="1"
            max="10000000"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label htmlFor="points-adjustment-reason">
          Lý do
          <input
            id="points-adjustment-reason"
            name="reason"
            minLength={10}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Bù điểm do chương trình tại quầy"
            required
          />
        </label>
      </div>

      <div className={styles.adjustmentPreview} aria-live="polite">
        <div>
          <span className={styles.label}>Số dư hiện tại</span>
          <strong>{balancePoints.toLocaleString('vi-VN')} điểm</strong>
        </div>
        <div>
          <span className={styles.label}>Số dư sau điều chỉnh</span>
          <strong>{previewBalance.toLocaleString('vi-VN')} điểm</strong>
        </div>
      </div>

      {insufficientPoints && <p className={styles.adjustmentWarning} role="alert">Không đủ điểm để trừ.</p>}
      <div className={styles.editorChecks}>
        <button type="submit" className={styles.saveButton} disabled={pending || insufficientPoints}>
          {pending ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          <span>Xác nhận điều chỉnh</span>
        </button>
      </div>
      <p className={styles.helperText}>Số dư khả dụng để trừ: {availablePoints.toLocaleString('vi-VN')} điểm. Mọi thay đổi tạo ledger audit, không sửa số dư trực tiếp.</p>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</span>}
    </form>
  );
}
