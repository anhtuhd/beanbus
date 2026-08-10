import 'server-only';

import { getCurrentProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isStoredValueConfigured } from './config';
import type { Database } from '@/lib/supabase/database.types';

export type StoredValueKind = 'topup' | 'flash_sale';

export type StoredValueCatalogItem = {
  id: string;
  kind: StoredValueKind;
  nameVi: string;
  nameEn: string;
  amountVnd: number;
  points: number;
  startsAt: string | null;
  endsAt: string | null;
  remainingQuantity: number | null;
  maxPerUser: number | null;
};

export type StoredValuePurchase = {
  purchaseType: StoredValueKind;
  purchaseId: string;
  amountVnd: number;
  points: number;
  purchaseStatus: string;
  paymentStatus: string | null;
  paymentCode: string | null;
  expiresAt: string;
  paidAt: string | null;
};

export type StoredValueCatalog = {
  enabled: boolean;
  authenticated: boolean;
  items: StoredValueCatalogItem[];
  error?: string;
};

export async function getStoredValueCatalog(): Promise<StoredValueCatalog> {
  if (!isStoredValueConfigured()) return { enabled: false, authenticated: true, items: [] };
  const profile = await getCurrentProfile();
  if (!profile) return { enabled: false, authenticated: false, items: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_stored_value_catalog');
  if (error) return { enabled: false, authenticated: true, items: [], error: 'Không thể tải chương trình nạp điểm lúc này.' };

  return {
    enabled: true,
    authenticated: true,
    items: (data ?? []).map((item: Database['public']['Functions']['get_stored_value_catalog']['Returns'][number]) => ({
      id: item.item_id,
      kind: item.kind,
      nameVi: item.name_vi,
      nameEn: item.name_en,
      amountVnd: item.amount_vnd,
      points: item.points,
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      remainingQuantity: item.remaining_quantity,
      maxPerUser: item.max_per_user,
    })),
  };
}

export async function getStoredValuePurchase(purchaseId: string): Promise<StoredValuePurchase | null> {
  if (!isStoredValueConfigured() || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return null;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_stored_value_purchase', { p_purchase_id: purchaseId });
  const purchase = data?.[0];
  if (error || !purchase) return null;
  return {
    purchaseType: purchase.purchase_type,
    purchaseId: purchase.purchase_id,
    amountVnd: purchase.amount_vnd,
    points: purchase.points,
    purchaseStatus: purchase.purchase_status,
    paymentStatus: purchase.payment_status,
    paymentCode: purchase.payment_code,
    expiresAt: purchase.expires_at,
    paidAt: purchase.paid_at,
  };
}
