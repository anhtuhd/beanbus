import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';
import { PRODUCTS, type Product } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';
import { getCurrentProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Thanh toán | Beanbus Coffee Roaster',
  description: 'Hoàn tất thông tin nhận hàng và thanh toán đơn Beanbus.',
  robots: { index: false, follow: false },
};

export const revalidate = 300;

export default async function CheckoutPage() {
  let products: Product[] = getAppMode() === 'demo' ? PRODUCTS : [];
  if (getAppMode() === 'production') {
    try {
      products = (await getCatalog()).products;
    } catch {
      // Checkout remains usable; the server pricing RPC stays authoritative.
    }
  }
  let initialPointsBalance = 0;
  let pointsPaymentEnabled = false;
  if (getAppMode() === 'production' && process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT === 'true') {
    const profile = await getCurrentProfile();
    if (profile?.role === 'member') {
      const supabase = await createServerSupabaseClient();
      const [{ data: policy }, { data: summary }] = await Promise.all([
        supabase.rpc('get_points_payment_policy'),
        supabase.rpc('get_member_loyalty_summary_v2', { p_user_id: profile.id }),
      ]);
      pointsPaymentEnabled = policy?.[0]?.enabled === true;
      initialPointsBalance = Number(summary?.[0]?.available_points ?? 0);
    }
  }
  return (
    <CheckoutClient
      catalogProducts={products}
      initialPointsBalance={initialPointsBalance}
      pointsPaymentEnabled={pointsPaymentEnabled}
    />
  );
}
