import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type VoucherRow = Database['public']['Tables']['vouchers']['Row'];
type AccountOrderItem = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'product_name_vi' | 'product_name_en' | 'quantity' | 'line_total_vnd'
>;
type MemberRequestRow = Database['public']['Functions']['get_member_requests']['Returns'][number];

export type MemberAccountOrder = {
  code: string;
  id: string;
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

export type MemberLoyaltySummary = {
  policyEnabled: boolean;
  balancePoints: number;
  earnedPoints: number;
  redeemedPoints: number;
  totalSpentVnd: number;
};

export type MemberLoyaltyEntry = Pick<
  Database['public']['Tables']['loyalty_ledger']['Row'],
  'id' | 'points' | 'source_type' | 'voucher_code' | 'note' | 'created_at'
>;

export type MemberReward = Pick<Database['public']['Tables']['loyalty_rewards']['Row'], 'id' | 'name_vi' | 'name_en' | 'points_cost' | 'discount_type' | 'discount_value' | 'minimum_subtotal_vnd' | 'maximum_discount_vnd'>;

export type MemberRequest = {
  id: string;
  referenceNumber: number;
  kind: 'booking' | 'customer';
  requestType: string;
  status: string;
  notificationStatus: 'not_configured' | 'pending' | 'sent' | 'failed';
  subject: string;
  createdAt: string;
};

export type MemberAccountData = {
  orders: MemberAccountOrder[];
  vouchers: MemberVoucher[];
  loyalty: MemberLoyaltySummary | null;
  loyaltyEntries: MemberLoyaltyEntry[];
  rewards: MemberReward[];
  requests: MemberRequest[];
  page: number;
  totalPages: number;
  totalOrders: number;
  totalRequests: number;
  loyaltyPage: number;
  loyaltyTotalPages: number;
  requestPage: number;
  requestTotalPages: number;
  voucherPage: number;
  voucherTotalPages: number;
  error?: string;
};

export type MemberAccountOrderDetail = MemberAccountOrder & {
  subtotalVnd: number;
  discountVnd: number;
  paymentMethod: OrderRow['payment_method'];
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  pickupAt: string | null;
  note: string | null;
  statusHistory: Array<{
    id: number;
    fromStatus: string;
    toStatus: string;
    actorType: 'admin' | 'system';
    createdAt: string;
  }>;
};

const ORDER_PAGE_SIZE = 10;
const LOYALTY_PAGE_SIZE = 20;
const REQUEST_PAGE_SIZE = 20;
const VOUCHER_PAGE_SIZE = 20;

function emptyAccountData(page: number, loyaltyPage: number, requestPage: number, voucherPage: number, error?: string): MemberAccountData {
  return { orders: [], vouchers: [], loyalty: null, loyaltyEntries: [], rewards: [], requests: [], page, totalPages: 1, totalOrders: 0, totalRequests: 0, loyaltyPage, loyaltyTotalPages: 1, requestPage, requestTotalPages: 1, voucherPage, voucherTotalPages: 1, error };
}

function mapOrder(
  order: Pick<OrderRow, 'id' | 'order_code' | 'status' | 'payment_status' | 'fulfillment' | 'total_vnd' | 'voucher_code' | 'created_at'>,
  items: AccountOrderItem[]
): MemberAccountOrder {
  return {
    id: order.id,
    code: order.order_code,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillment: order.fulfillment,
    totalVnd: order.total_vnd,
    voucherCode: order.voucher_code,
    createdAt: order.created_at,
    items: items.map((item) => ({
      id: item.id,
      nameVi: item.product_name_vi,
      nameEn: item.product_name_en,
      quantity: item.quantity,
      lineTotalVnd: item.line_total_vnd,
    })),
  };
}

function mapMemberRequest(request: MemberRequestRow): MemberRequest {
  const subject = request.kind === 'booking' && request.reservation_at
    ? `Đặt bàn · ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(request.reservation_at))}`
    : request.subject_reference ?? request.request_type;

  return {
    id: request.id,
    referenceNumber: request.reference_number,
    kind: request.kind as MemberRequest['kind'],
    requestType: request.request_type,
    status: request.status,
    notificationStatus: request.notification_status as MemberRequest['notificationStatus'],
    subject,
    createdAt: request.created_at,
  };
}

export async function getMemberAccountData(requestedPage = 1, requestedLoyaltyPage = 1, requestedRequestPage = 1, requestedVoucherPage = 1): Promise<MemberAccountData> {
  const page = boundedPage(requestedPage);
  const loyaltyPage = boundedPage(requestedLoyaltyPage);
  const requestPage = boundedPage(requestedRequestPage);
  const voucherPage = boundedPage(requestedVoucherPage);
  const profile = await getCurrentProfile();
  if (!profile) return emptyAccountData(page, loyaltyPage, requestPage, voucherPage, 'Phiên đăng nhập đã hết hạn.');
  const supabase = await createServerSupabaseClient();
  const [ordersResult, loyaltyResult, loyaltyEntriesResult, rewardsResult, requestsResult, requestCountResult] = await Promise.all([
    supabase
    .from('orders')
    .select('id, order_code, status, payment_status, fulfillment, total_vnd, voucher_code, created_at', { count: 'exact' })
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * ORDER_PAGE_SIZE, page * ORDER_PAGE_SIZE - 1),
    supabase.rpc('get_member_loyalty_summary', { p_user_id: profile.id }),
    supabase.from('loyalty_ledger').select('id, points, source_type, voucher_code, note, created_at', { count: 'exact' }).eq('user_id', profile.id).order('created_at', { ascending: false }).range((loyaltyPage - 1) * LOYALTY_PAGE_SIZE, loyaltyPage * LOYALTY_PAGE_SIZE - 1),
    supabase.from('loyalty_rewards').select('id, name_vi, name_en, points_cost, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd').eq('is_active', true).order('points_cost'),
    supabase.rpc('get_member_requests', { p_page: requestPage, p_page_size: REQUEST_PAGE_SIZE, p_user_id: profile.id }),
    supabase.rpc('get_member_request_count', { p_user_id: profile.id }),
  ]);

  if (ordersResult.error) {
    return emptyAccountData(page, loyaltyPage, requestPage, voucherPage, 'Không thể tải dữ liệu hội viên lúc này.');
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
    .select('code, discount_type, discount_value, minimum_subtotal_vnd, maximum_discount_vnd, starts_at, ends_at', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range((voucherPage - 1) * VOUCHER_PAGE_SIZE, voucherPage * VOUCHER_PAGE_SIZE - 1);

  if (itemsResult.error || vouchersResult.error || loyaltyResult.error || !loyaltyResult.data?.[0] || loyaltyEntriesResult.error || rewardsResult.error || requestsResult.error || requestCountResult.error) {
    return emptyAccountData(page, loyaltyPage, requestPage, voucherPage, 'Không thể tải dữ liệu hội viên lúc này.');
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

  const requests = (requestsResult.data ?? []).map(mapMemberRequest);
  const totalRequests = requestCountResult.data ?? 0;

  return {
    orders: orders.map((order) => mapOrder(order, itemsByOrder.get(order.id) ?? [])),
    vouchers,
    loyalty: {
      policyEnabled: loyaltyResult.data[0].policy_enabled,
      balancePoints: loyaltyResult.data[0].balance_points,
      earnedPoints: loyaltyResult.data[0].earned_points,
      redeemedPoints: loyaltyResult.data[0].redeemed_points,
      totalSpentVnd: loyaltyResult.data[0].total_spent_vnd,
    },
    loyaltyEntries: loyaltyEntriesResult.data ?? [],
    rewards: rewardsResult.data ?? [],
    requests,
    page,
    totalPages: Math.max(1, Math.ceil((ordersResult.count ?? 0) / ORDER_PAGE_SIZE)),
    totalOrders: ordersResult.count ?? 0,
    totalRequests,
    loyaltyPage,
    loyaltyTotalPages: Math.max(1, Math.ceil((loyaltyEntriesResult.count ?? 0) / LOYALTY_PAGE_SIZE)),
    requestPage,
    requestTotalPages: Math.max(1, Math.ceil(totalRequests / REQUEST_PAGE_SIZE)),
    voucherPage,
    voucherTotalPages: Math.max(1, Math.ceil((vouchersResult.count ?? 0) / VOUCHER_PAGE_SIZE)),
  };
}

export async function getMemberAccountOrder(id: string): Promise<MemberAccountOrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createServerSupabaseClient();
  const orderResult = await supabase
    .from('orders')
    .select('id, order_code, status, payment_status, fulfillment, total_vnd, voucher_code, created_at, subtotal_vnd, discount_vnd, payment_method, customer_name, customer_phone, delivery_address, pickup_at, note')
    .eq('user_id', profile.id)
    .eq('id', id)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) return null;

  const [itemsResult, historyResult] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, order_id, product_name_vi, product_name_en, quantity, line_total_vnd')
      .eq('order_id', id),
    supabase
      .from('order_status_history')
      .select('id, from_status, to_status, actor_type, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (itemsResult.error || historyResult.error) return null;

  return {
    ...mapOrder(orderResult.data, itemsResult.data ?? []),
    subtotalVnd: orderResult.data.subtotal_vnd,
    discountVnd: orderResult.data.discount_vnd,
    paymentMethod: orderResult.data.payment_method,
    customerName: orderResult.data.customer_name,
    customerPhone: orderResult.data.customer_phone,
    deliveryAddress: orderResult.data.delivery_address,
    pickupAt: orderResult.data.pickup_at,
    note: orderResult.data.note,
    statusHistory: (historyResult.data ?? []).map((entry) => ({
      id: entry.id,
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
      actorType: entry.actor_type,
      createdAt: entry.created_at,
    })),
  };
}
