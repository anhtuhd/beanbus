import AccountClient, { type AccountTab } from './AccountClient';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { toUserProfile } from '@/lib/auth/types';
import { getAppMode } from '@/lib/env';
import { getMemberAccountData } from '@/lib/account/queries';
import { isStoredValueConfigured } from '@/lib/stored-value/config';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const appMode = getAppMode();
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawLoyaltyPage = Array.isArray(params.loyaltyPage) ? params.loyaltyPage[0] : params.loyaltyPage;
  const rawRequestPage = Array.isArray(params.requestPage) ? params.requestPage[0] : params.requestPage;
  const rawVoucherPage = Array.isArray(params.voucherPage) ? params.voucherPage[0] : params.voucherPage;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const requestedPage = Number.parseInt(rawPage ?? '1', 10);
  const requestedLoyaltyPage = Number.parseInt(rawLoyaltyPage ?? '1', 10);
  const requestedRequestPage = Number.parseInt(rawRequestPage ?? '1', 10);
  const requestedVoucherPage = Number.parseInt(rawVoucherPage ?? '1', 10);
  const initialTab: AccountTab = ['membership', 'orders', 'requests', 'rewards', 'vouchers'].includes(rawTab as AccountTab)
    ? rawTab as AccountTab
    : 'membership';
  if (appMode === 'demo') return <AccountClient initialTab={initialTab} />;

  const profile = await requireProfile('/account');
  if (profile.role === 'admin') redirect('/admin');
  const accountData = await getMemberAccountData(requestedPage, requestedLoyaltyPage, requestedRequestPage, requestedVoucherPage, initialTab);
  return (
    <AccountClient
      initialUser={toUserProfile(profile)}
      production
      phoneAuthEnabled={
        process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === 'true'
        && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
      }
      initialTab={initialTab}
      storedValueConfigured={isStoredValueConfigured()}
      initialOrders={accountData.orders}
      availableVouchers={accountData.vouchers}
      accountError={accountData.error}
      loyalty={accountData.loyalty}
      loyaltyEntries={accountData.loyaltyEntries}
      rewards={accountData.rewards}
      memberRequests={accountData.requests}
      totalOrders={accountData.totalOrders}
      totalRequests={accountData.totalRequests}
      orderPage={accountData.page}
      orderTotalPages={accountData.totalPages}
      loyaltyPage={accountData.loyaltyPage}
      loyaltyTotalPages={accountData.loyaltyTotalPages}
      requestPage={accountData.requestPage}
      requestTotalPages={accountData.requestTotalPages}
      voucherPage={accountData.voucherPage}
      voucherTotalPages={accountData.voucherTotalPages}
    />
  );
}
