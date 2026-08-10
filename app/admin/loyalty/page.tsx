import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import LoyaltyPolicyForm from './LoyaltyPolicyForm';
import styles from '../requests/requests.module.css';

export default async function AdminLoyaltyPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_loyalty_policy');
  const policy = data?.[0];

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1><ShieldCheck size={24} /> Loyalty Policy</h1>
          <p>Quản lý rule tích điểm; mọi thay đổi được ghi audit.</p>
        </div>
      </header>
      {error || !policy ? (
        <div className={styles.stateBox} role="alert">Không thể tải loyalty policy.</div>
      ) : (
        <section className={styles.editorDetails}>
          <h2>Chính sách hiện tại</h2>
          <LoyaltyPolicyForm enabled={policy.enabled} earnBps={policy.earn_bps} codEligible={policy.cod_eligible} />
        </section>
      )}
    </main>
  );
}
