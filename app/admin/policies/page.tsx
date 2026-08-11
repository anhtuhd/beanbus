import Link from 'next/link';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import CommercePolicyForm from './CommercePolicyForm';
import styles from '../requests/requests.module.css';

export default async function AdminPoliciesPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_commerce_policy');
  const policy = data?.[0];

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1><Settings2 size={24} /> Chính sách thương mại</h1>
          <p>Admin tự cấu hình voucher, loyalty và hoàn tiền; thay đổi đều có audit.</p>
        </div>
      </header>
      {error || !policy ? (
        <div className={styles.stateBox} role="alert">Không thể tải chính sách thương mại.</div>
      ) : (
        <section className={styles.editorDetails}>
          <h2>Chính sách hiện tại</h2>
          <CommercePolicyForm
            refundEnabled={policy.refund_enabled}
            refundWindowHours={policy.refund_window_hours}
            voucherOnCancel={policy.voucher_on_cancel}
            voucherOnRefund={policy.voucher_on_refund}
            loyaltyReverseOnCancel={policy.loyalty_reverse_on_cancel}
            loyaltyReverseOnRefund={policy.loyalty_reverse_on_refund}
          />
        </section>
      )}
    </main>
  );
}
