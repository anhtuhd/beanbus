import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Coins, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { getAppMode } from '@/lib/env';
import StoredValuePolicyForm from './StoredValuePolicyForm';
import TopupPackageForm from './TopupPackageForm';
import FlashSaleCampaignForm from './FlashSaleCampaignForm';
import styles from '../requests/requests.module.css';

type TopupPackage = Database['public']['Tables']['topup_packages']['Row'];
type FlashSaleCampaign = Database['public']['Tables']['flash_sale_campaigns']['Row'];
type StoredValuePolicyHistory = Database['public']['Tables']['stored_value_policy_history']['Row'];
type StoredValueAdminCatalog = {
  policy: Pick<Database['public']['Tables']['stored_value_policy']['Row'], 'enabled' | 'topup_enabled' | 'flash_sale_enabled'>;
  topups: TopupPackage[];
  campaigns: FlashSaleCampaign[];
  policyHistory: StoredValuePolicyHistory[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseCatalog(value: unknown): StoredValueAdminCatalog | null {
  if (!isRecord(value) || !isRecord(value.policy) || !Array.isArray(value.topups) || !Array.isArray(value.campaigns) || !Array.isArray(value.policyHistory)) return null;
  const policy = value.policy;
  if (typeof policy.enabled !== 'boolean' || typeof policy.topup_enabled !== 'boolean' || typeof policy.flash_sale_enabled !== 'boolean') return null;
  return {
    policy: { enabled: policy.enabled, topup_enabled: policy.topup_enabled, flash_sale_enabled: policy.flash_sale_enabled },
    topups: value.topups as TopupPackage[],
    campaigns: value.campaigns as FlashSaleCampaign[],
    policyHistory: value.policyHistory as StoredValuePolicyHistory[],
  };
}

export default async function AdminStoredValuePage() {
  if (getAppMode() === 'demo') redirect('/admin');
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  await admin.rpc('expire_pending_stored_value_payments', { p_limit: 100 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_admin_stored_value_catalog');
  const catalog = parseCatalog(data);

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1><Coins size={24} /> Stored-value</h1>
        </div>
      </header>
      {error || !catalog ? (
        <div className={styles.stateBox} role="alert">Không thể tải stored-value catalog.</div>
      ) : (
        <>
          <section className={styles.editorDetails}>
            <h2><ShieldCheck size={20} /> Policy</h2>
            <StoredValuePolicyForm enabled={catalog.policy.enabled} topupEnabled={catalog.policy.topup_enabled} flashSaleEnabled={catalog.policy.flash_sale_enabled} />
            {catalog.policyHistory.length > 0 && (
              <div className={styles.auditList}>
                <h3>Policy history</h3>
                {catalog.policyHistory.map((entry) => (
                  <div key={entry.id} className={styles.auditRow}>
                    <span>{entry.enabled ? 'Enabled' : 'Disabled'} · top-up {entry.topup_enabled ? 'on' : 'off'} · flash-sale {entry.flash_sale_enabled ? 'on' : 'off'}</span>
                    <time dateTime={entry.created_at}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(entry.created_at))}</time>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className={styles.editorDetails}>
            <h2>Gói nạp điểm</h2>
            <TopupPackageForm />
            <div className={styles.editorList}>
              {catalog.topups.map((item) => <TopupPackageForm key={item.id} item={item} />)}
            </div>
          </section>
          <section className={styles.editorDetails}>
            <h2>Flash-sale campaigns</h2>
            <FlashSaleCampaignForm />
            <div className={styles.editorList}>
              {catalog.campaigns.map((item) => <FlashSaleCampaignForm key={item.id} item={item} />)}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
