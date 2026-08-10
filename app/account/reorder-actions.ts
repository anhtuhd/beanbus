'use server';

import { getCurrentProfile } from '@/lib/auth/session';
import { getCatalogProduct } from '@/lib/catalog/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { ReorderState } from './reorder-state';

type OrderItemRow = Pick<Database['public']['Tables']['order_items']['Row'], 'id' | 'product_id' | 'quantity' | 'special_note'>;
type OrderOptionRow = Database['public']['Tables']['order_item_options']['Row'];

export async function loadReorderItems(_previous: ReorderState, formData: FormData): Promise<ReorderState> {
  const profile = await getCurrentProfile();
  const orderId = String(formData.get('orderId') ?? '');
  if (!profile || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ...initialState('Không thể tải lại đơn hàng.'), status: 'error' };
  }

  const supabase = await createServerSupabaseClient();
  const orderResult = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('user_id', profile.id)
    .maybeSingle();
  if (orderResult.error || !orderResult.data) {
    return { ...initialState('Không tìm thấy đơn hàng của bạn.'), status: 'error' };
  }

  const itemsResult = await supabase
    .from('order_items')
    .select('id, product_id, quantity, special_note')
    .eq('order_id', orderId);
  if (itemsResult.error) {
    return { ...initialState('Không thể tải món trong đơn hàng.'), status: 'error' };
  }

  const itemRows = (itemsResult.data ?? []) as OrderItemRow[];
  const optionResult = itemRows.length
    ? await supabase
      .from('order_item_options')
      .select('order_item_id, option_id, option_name_en, option_name_vi, extra_price_vnd')
      .in('order_item_id', itemRows.map((item) => item.id))
    : { data: [], error: null };
  if (optionResult.error) {
    return { ...initialState('Không thể tải tùy chọn món trong đơn hàng.'), status: 'error' };
  }

  const optionsByItem = new Map<string, OrderOptionRow[]>();
  for (const option of (optionResult.data ?? []) as OrderOptionRow[]) {
    const options = optionsByItem.get(option.order_item_id) ?? [];
    options.push(option);
    optionsByItem.set(option.order_item_id, options);
  }

  const items = [] as ReorderState['items'];
  let skipped = 0;
  for (const item of itemRows) {
    const product = await getCatalogProduct(item.product_id);
    if (!product || !product.isAvailable) {
      skipped += 1;
      continue;
    }
    const selectedOptions = (optionsByItem.get(item.id) ?? [])
      .map((option) => product.options?.find((candidate) => candidate.id === option.option_id))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));
    items.push({ product, quantity: item.quantity, selectedOptions, specialNote: item.special_note ?? undefined });
  }

  if (items.length === 0) {
    return { ...initialState('Các món trong đơn cũ hiện không còn bán.'), status: 'error', skipped };
  }

  return {
    status: 'success',
    message: skipped ? `Đã tải ${items.length} món; bỏ qua ${skipped} món không còn bán.` : 'Đã tải lại toàn bộ món trong đơn.',
    orderId,
    items,
    skipped,
  };
}

function initialState(message: string): ReorderState {
  return { status: 'idle', message, items: [], skipped: 0 };
}
