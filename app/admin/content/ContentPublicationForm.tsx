'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { updateContentPublication } from './actions';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Props = { contentId: string; contentType: 'event' | 'blog'; isPublished: boolean };

const initialContentPublicationState = { message: '', status: 'idle' as const };

export default function ContentPublicationForm({ contentId, contentType, isPublished }: Props) {
  const [state, action, pending] = useActionState(updateContentPublication, initialContentPublicationState);
  return (
    <form action={action} className={styles.productStatusForm}>
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="contentType" value={contentType} />
      <label><input type="checkbox" name="isPublished" defaultChecked={isPublished} disabled={pending} /> Công khai</label>
      <button type="submit" className={styles.saveButton} disabled={pending} title="Lưu trạng thái công bố">
        {pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}
        <span><LocalizedText vi={pending ? 'Đang lưu' : 'Lưu'} en={pending ? 'Saving...' : 'Save'} /></span>
      </button>
      {state.status !== 'idle' && (
        <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>
      )}
    </form>
  );
}
