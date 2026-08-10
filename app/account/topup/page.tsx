import StoredValueClient from '../StoredValueClient';
import { requireProfile } from '@/lib/auth/session';
import { getAppMode } from '@/lib/env';
import { getStoredValueCatalog } from '@/lib/stored-value/queries';

export default async function TopupPage() {
  if (getAppMode() === 'production') await requireProfile('/account/topup');
  const catalog = await getStoredValueCatalog();
  return (
    <StoredValueClient
      kind="topup"
      enabled={catalog.enabled}
      items={catalog.items.filter((item) => item.kind === 'topup')}
      error={catalog.error}
    />
  );
}
