import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toSessionProfile, type SessionProfile } from './types';

export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_current_profile');
  const profile = data?.[0];

  if (error || !profile) return null;

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

export async function requireOperator(): Promise<SessionProfile> {
  const profile = await requireProfile('/pos');

  if (profile.role !== 'admin' && profile.role !== 'staff') redirect('/forbidden');

  return profile;
}
