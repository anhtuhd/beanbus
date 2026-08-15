import { getSiteUrl } from '@/lib/env';
import { requireOperator } from '@/lib/auth/session';
import { verifyMemberPass } from '@/lib/member-pass';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== getSiteUrl()) return Response.json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin không hợp lệ.' } }, { status: 403 });
  await requireOperator();
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: { code: 'INVALID_BODY', message: 'Dữ liệu không hợp lệ.' } }, { status: 400 }); }
  const token = body && typeof body === 'object' && 'token' in body && typeof body.token === 'string' ? body.token.slice(0, 512) : '';
  const pass = verifyMemberPass(token);
  if (!pass) return Response.json({ error: { code: 'INVALID_MEMBER_PASS', message: 'Thẻ hội viên đã hết hạn hoặc không hợp lệ.' } }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: consumed, error: consumeError } = await supabase.rpc('consume_member_pass_nonce', { p_nonce_hash: pass.nonceHash });
  if (consumeError || typeof consumed !== 'string') return Response.json({ error: { code: 'INVALID_MEMBER_PASS', message: 'Thẻ hội viên đã được sử dụng hoặc không hợp lệ.' } }, { status: 400 });
  const admin = createAdminSupabaseClient();
  const { data: member, error } = await admin.from('profiles').select('id, member_number, full_name, phone, pending_phone, membership_status').eq('id', consumed).eq('role', 'member').neq('membership_status', 'blocked').maybeSingle();
  if (error || !member) return Response.json({ error: { code: 'MEMBER_NOT_FOUND', message: 'Không tìm thấy hội viên.' } }, { status: 404 });
  const { data: ledger } = await admin.from('loyalty_ledger').select('points').eq('user_id', consumed);
  const availablePoints = Math.max(0, (ledger ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0));
  return Response.json({
    member: {
      id: member.id,
      member_number: member.member_number,
      full_name: member.full_name,
      phone: member.phone,
      pending_phone: member.pending_phone,
      membership_status: member.membership_status,
      available_points: availablePoints,
    },
  }, { headers: { 'cache-control': 'private, no-store' } });
}
