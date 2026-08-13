'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateAdminStoredValuePolicy } from './actions';
import { initialStoredValueAdminState } from './stored-value-state';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function StoredValuePolicyForm({ enabled, topupEnabled, flashSaleEnabled }: { enabled: boolean; topupEnabled: boolean; flashSaleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(updateAdminStoredValuePolicy, initialStoredValueAdminState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="enabled" defaultChecked={enabled} /> Kích hoạt stored-value</label>
        <label><input type="checkbox" name="topupEnabled" defaultChecked={topupEnabled} /> Cho phép nạp điểm</label>
        <label><input type="checkbox" name="flashSaleEnabled" defaultChecked={flashSaleEnabled} /> Cho phép flash-sale</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span><LocalizedText vi={pending ? 'Đang lưu' : 'Lưu policy'} en={pending ? 'Saving...' : 'Save policy'} /></span></button>
      </div>
      <p className={styles.helperText}>Policy này vẫn đi qua feature gate production + Sepay. Migration không tự mở chức năng.</p>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
