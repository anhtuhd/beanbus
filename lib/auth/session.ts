import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toSessionProfile, type SessionProfile } from './types';

export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, member_number, full_name, phone, email, birthday, avatar_url, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) return null;

  return toSessionProfile(profile);
});

export async function requireProfile(next = '/account'): Promise<SessionProfile> {
  const profile = await getCurrentProfile();

  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);

  return profile;
}

export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await requireProfile('/admin');

  if (profile.role !== 'admin') redirect('/forbidden');

  return profile;
}
