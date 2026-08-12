'use client';

import { useActionState } from 'react';
import { KeyRound, Mail, Save } from 'lucide-react';
import {
  requestAdminPasswordReset,
  updateAdminPassword,
} from './actions';
import { initialPasswordManagementState } from './security-state';
import styles from '../admin.module.css';

type Props = { recovery: boolean };

export default function SecurityForm({ recovery }: Props) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateAdminPassword,
    initialPasswordManagementState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestAdminPasswordReset,
    initialPasswordManagementState,
  );

  return (
    <div className={styles.securityGrid}>
      <section className={styles.securityPanel}>
        <div className={styles.securityPanelHeader}>
          <KeyRound size={20} aria-hidden="true" />
          <div>
            <h2>{recovery ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}</h2>
            <p>{recovery ? 'Liên kết email đã xác minh. Hãy tạo mật khẩu mới cho tài khoản admin.' : 'Xác nhận mật khẩu hiện tại trước khi đổi mật khẩu.'}</p>
          </div>
        </div>
        <form action={updateAction} className={styles.form}>
          <input type="hidden" name="recovery" value={recovery ? 'true' : 'false'} />
          {!recovery && (
            <div className={styles.inputGroup}>
              <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
              <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required disabled={updatePending} />
            </div>
          )}
          <div className={styles.inputGroup}>
            <label htmlFor="password">Mật khẩu mới</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={updatePending} />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="passwordConfirmation">Xác nhận mật khẩu mới</label>
            <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={updatePending} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={updatePending}>
            <Save size={16} aria-hidden="true" />
            {updatePending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
          {updateState.status !== 'idle' && (
            <p className={updateState.status === 'error' ? styles.actionError : styles.actionSuccess} role={updateState.status === 'error' ? 'alert' : 'status'} aria-live="polite">
              {updateState.message}
            </p>
          )}
        </form>
      </section>

      {!recovery && (
        <section className={styles.securityPanel}>
          <div className={styles.securityPanelHeader}>
            <Mail size={20} aria-hidden="true" />
            <div>
              <h2>Đặt lại qua email</h2>
              <p>Gửi một liên kết đặt lại mật khẩu tới email admin đã đăng ký.</p>
            </div>
          </div>
          <form action={resetAction} className={styles.form}>
            <button type="submit" className="btn btn-dark btn-sm" disabled={resetPending}>
              <Mail size={16} aria-hidden="true" />
              {resetPending ? 'Đang gửi...' : 'Gửi email reset'}
            </button>
            {resetState.status !== 'idle' && (
              <p className={resetState.status === 'error' ? styles.actionError : styles.actionSuccess} role={resetState.status === 'error' ? 'alert' : 'status'} aria-live="polite">
                {resetState.message}
              </p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
