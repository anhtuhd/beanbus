import { getAppMode } from '@/lib/env';
import { getCurrentProfile } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'cache-control': 'private, no-store',
};

function disabledResponse() {
  return Response.json(
    { enabled: false, availablePoints: 0 },
    { headers: noStoreHeaders },
  );
}

export async function GET() {
  if (
    getAppMode() !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT !== 'true'
  ) {
    return disabledResponse();
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'member') return disabledResponse();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_member_loyalty_summary_v2', {
    p_user_id: profile.id,
  });
  const summary = data?.[0];

  if (error || !summary || summary.points_payment_enabled !== true) {
    return disabledResponse();
  }

  return Response.json(
    {
      enabled: true,
      availablePoints: Math.max(0, Number(summary.available_points ?? 0)),
    },
    { headers: noStoreHeaders },
  );
}
