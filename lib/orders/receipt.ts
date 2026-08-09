import 'server-only';

import { parseOrderReceipt, type OrderReceipt } from './receipt-data';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getOrderReceipt(id: string, receipt: string): Promise<OrderReceipt | null> {
  if (!UUID.test(id) || !UUID.test(receipt)) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_order_receipt', {
    p_order_id: id,
    p_receipt_token: receipt,
  });

  return error ? null : parseOrderReceipt(data);
}
