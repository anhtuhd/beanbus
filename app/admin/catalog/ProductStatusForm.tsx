'use client';

import { useActionState } from 'react';
import { Archive, Check, LoaderCircle } from 'lucide-react';
import { initialProductStatusState, updateAdminProductStatus } from './actions';
import styles from '../requests/requests.module.css';

type Props = {
  isAvailable: boolean;
  isPublished: boolean;
  productId: string;
};

export default function ProductStatusForm({ isAvailable, isPublished, productId }: Props) {
  const [state, formAction, pending] = useActionState(updateAdminProductStatus, initialProductStatusState);

  return (
    <form action={formAction} className={styles.productStatusForm}>
      <input type="hidden" name="productId" value={productId} />
      <label><input type="checkbox" name="isAvailable" defaultChecked={isAvailable} disabled={pending} /> Đang bán</label>
      <label><input type="checkbox" name="isPublished" defaultChecked={isPublished} disabled={pending} /> Công khai</label>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu trạng thái sản phẩm">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span>{pending ? 'Đang lưu' : 'Lưu'}</span>
      </button>
      <button type="submit" name="intent" value="archive" className={styles.archiveButton} disabled={pending || (!isAvailable && !isPublished)} title="Lưu trữ sản phẩm, không xóa dữ liệu đơn cũ">
        <Archive size={16} />
        <span>{pending ? 'Đang lưu' : (!isAvailable && !isPublished ? 'Đã lưu trữ' : 'Lưu trữ')}</span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
