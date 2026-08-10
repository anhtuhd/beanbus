import AccountClient from './AccountClient';
import { requireProfile } from '@/lib/auth/session';
import { toUserProfile } from '@/lib/auth/types';
import { getAppMode } from '@/lib/env';
import { getMemberAccountData } from '@/lib/account/queries';

export default async function AccountPage() {
  if (getAppMode() === 'demo') return <AccountClient />;

  const profile = await requireProfile('/account');
  const accountData = await getMemberAccountData();
  return (
    <AccountClient
      initialUser={toUserProfile(profile)}
      production
      initialOrders={accountData.orders}
      availableVouchers={accountData.vouchers}
      accountError={accountData.error}
    />
  );
}
