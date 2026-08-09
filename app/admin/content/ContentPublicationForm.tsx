'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { initialContentPublicationState, updateContentPublication } from './actions';
import styles from '../requests/requests.module.css';

type Props = { contentId: string; contentType: 'event' | 'blog'; isPublished: boolean };

export default function ContentPublicationForm({ contentId, contentType, isPublished }: Props) {
  const [state, action, pending] = useActionState(updateContentPublication, initialContentPublicationState);
  return (
    <form action={action} className={styles.productStatusForm}>
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="contentType" value={contentType} />
      <label><input type="checkbox" name="isPublished" defaultChecked={isPublished} disabled={pending} /> Công khai</label>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu trạng thái công bố">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span>{pending ? 'Đang lưu' : 'Lưu'}</span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} aria-live="polite">{state.message}</span>
      )}
    </form>
  );
}
