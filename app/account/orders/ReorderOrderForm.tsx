'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { loadReorderItems } from '../reorder-actions';
import { initialReorderState } from '../reorder-state';
import styles from '../account.module.css';

export default function ReorderOrderForm({ orderId }: { orderId: string }) {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const [state, action, pending] = useActionState(loadReorderItems, initialReorderState);
  const processedOrder = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== 'success' || !state.orderId || processedOrder.current === state.orderId) return;
    state.items.forEach((item) => addToCart(item.product, item.quantity, item.selectedOptions, item.specialNote));
    processedOrder.current = state.orderId;
  }, [addToCart, state]);

  return (
    <div className={styles.detailActions}>
      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          <RotateCcw size={15} />
          <span>{pending ? t('Đang tải...', 'Loading...') : t('Đặt lại đơn này', 'Reorder this order')}</span>
        </button>
      </form>
      {state.status !== 'idle' && (
        <p className={state.status === 'error' ? styles.accountStatus : styles.formSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <Link href="/order/cart" className="btn btn-dark btn-sm">
          <span>{t('Xem giỏ hàng', 'View cart')}</span>
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
