import StoredValueClient from '@/app/account/StoredValueClient';
import { requireProfile } from '@/lib/auth/session';
import { getAppMode } from '@/lib/env';
import { getStoredValueCatalog } from '@/lib/stored-value/queries';

export default async function FlashSalePage() {
  if (getAppMode() === 'production') await requireProfile('/flash-sale');
  const catalog = await getStoredValueCatalog();
  return (
    <StoredValueClient
      kind="flash_sale"
      enabled={catalog.enabled}
      items={catalog.items.filter((item) => item.kind === 'flash_sale')}
      error={catalog.error}
    />
  );
}
