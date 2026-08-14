import 'server-only';

import { getCurrentProfile } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export type MemberPaymentHistoryEntry = Database['public']['Functions']['get_member_payment_history']['Returns'][number];

export type MemberPaymentHistory = {
  items: MemberPaymentHistoryEntry[];
  page: number;
  totalPages: number;
  totalCount: number;
  error?: string;
};

const PAGE_SIZE = 20;

export async function getMemberPaymentHistory(requestedPage = 1): Promise<MemberPaymentHistory> {
  const page = boundedPage(requestedPage);
  const profile = await getCurrentProfile();
  if (!profile) return { items: [], page, totalPages: 1, totalCount: 0, error: 'Phiên đăng nhập đã hết hạn.' };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_member_payment_history', {
    p_page: page,
    p_page_size: PAGE_SIZE,
  });
  if (error) return { items: [], page, totalPages: 1, totalCount: 0, error: 'Không thể tải lịch sử thanh toán lúc này.' };

  const items = data ?? [];
  const totalCount = items[0]?.total_count ?? 0;
  return {
    items,
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    totalCount,
  };
}
