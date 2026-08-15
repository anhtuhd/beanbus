import { getSiteUrl } from '@/lib/env';
import { getCurrentProfile } from '@/lib/auth/session';
import { issueMemberPass } from '@/lib/member-pass';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === getSiteUrl();
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return Response.json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin không hợp lệ.' } }, { status: 403 });
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'member' || profile.membershipStatus === 'blocked') return Response.json({ error: { code: 'MEMBER_REQUIRED', message: 'Cần đăng nhập hội viên.' } }, { status: 403 });
  try {
  const pass = issueMemberPass();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc('issue_member_pass_nonce', { p_nonce_hash: pass.nonceHash, p_expires_at: pass.expiresAt });
    if (error) return Response.json({ error: { code: 'PASS_UNAVAILABLE', message: 'Không thể tạo thẻ hội viên lúc này.' } }, { status: 503 });
    return Response.json({ token: pass.token, expiresAt: pass.expiresAt }, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return Response.json({ error: { code: 'PASS_UNAVAILABLE', message: 'Không thể tạo thẻ hội viên lúc này.' } }, { status: 503 });
  }
}
