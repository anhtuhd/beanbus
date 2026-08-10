import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type VoucherRow = Database['public']['Tables']['vouchers']['Row'];
type AccountOrderItem = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'product_name_vi' | 'product_name_en' | 'quantity' | 'line_total_vnd'
>;

export type MemberAccountOrder = {
  id: string;
  number: number;
  status: OrderRow['status'];
  paymentStatus: OrderRow['payment_status'];
  fulfillment: OrderRow['fulfillment'];
  totalVnd: number;
  voucherCode: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    nameVi: string;
    nameEn: string;
    quantity: number;
    lineTotalVnd: number;
  }>;
};

export type MemberVoucher = Pick<
  VoucherRow,
  'code' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd' | 'ends_at'
>;

export type MemberAccountData = {
  orders: MemberAccountOrder[];
  vouchers: MemberVoucher[];
  error?: string;
};

const ORDER_LIMIT = 20;

export async function getMemberAccountData(): Promise<MemberAccountData> {
  const supabase = await createServerSupabaseClient();
  const ordersResult = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, fulfillment, total_vnd, voucher_code, created_at')
    .order('created_at', { ascending: false })
    .range(0, ORDER_LIMIT - 1);

  if (ordersResult.error) {
    return { orders: [], vouchers: [], error: 'Không thể tải dữ liệu hội viên lúc này.' };
  }

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  const itemsResult = orderIds.length
    ? await supabase
      .from('order_items')
      .select('id, order_id, product_name_vi, product_name_en, quantity, line_total_vnd')
      .in('order_id', orderIds)
    : { data: [], error: null };

  const vouchersResult = await supabase
    .from('vouchers')
    .select('code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, starts_at, ends_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (itemsResult.error || vouchersResult.error) {
    return { orders: [], vouchers: [], error: 'Không thể tải dữ liệu hội viên lúc này.' };
  }

  const itemsByOrder = new Map<string, AccountOrderItem[]>();
  for (const item of itemsResult.data ?? []) {
    const items = itemsByOrder.get(item.order_id) ?? [];
    items.push(item);
    itemsByOrder.set(item.order_id, items);
  }

  const now = Date.now();
  const vouchers: MemberVoucher[] = (vouchersResult.data ?? []).filter((voucher) => {
    const startsAt = voucher.starts_at ? Date.parse(voucher.starts_at) : null;
    const endsAt = voucher.ends_at ? Date.parse(voucher.ends_at) : null;
    return (startsAt === null || startsAt <= now) && (endsAt === null || endsAt > now);
  });

  return {
    orders: orders.map((order) => ({
      id: order.id,
      number: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillment: order.fulfillment,
      totalVnd: order.total_vnd,
      voucherCode: order.voucher_code,
      createdAt: order.created_at,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        id: item.id,
        nameVi: item.product_name_vi,
        nameEn: item.product_name_en,
        quantity: item.quantity,
        lineTotalVnd: item.line_total_vnd,
      })),
    })),
    vouchers,
  };
}
