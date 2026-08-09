import AccountClient from './AccountClient';
import { requireProfile } from '@/lib/auth/session';
import { toUserProfile } from '@/lib/auth/types';
import { getAppMode } from '@/lib/env';

export default async function AccountPage() {
  if (getAppMode() === 'demo') return <AccountClient />;

  const profile = await requireProfile('/account');
  return <AccountClient initialUser={toUserProfile(profile)} production />;
}
