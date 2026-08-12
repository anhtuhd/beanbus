import HomeClient from './HomeClient';
import { PRODUCTS } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';
import CatalogUnavailable from '@/components/catalog/CatalogUnavailable';

export const dynamic = 'force-dynamic';

function DemoHomePage() {
  return <HomeClient products={PRODUCTS} />;
}

async function ProductionHomePage() {
  let catalog;
  try {
    catalog = await getCatalog();
  } catch {
    return (
      <CatalogUnavailable
        retryHref="/"
        title="Chưa thể tải dữ liệu cửa hàng"
        description="Trang chủ đang chờ kết nối dữ liệu sản phẩm. Vui lòng thử lại sau ít phút."
      />
    );
  }
  return <HomeClient products={catalog.products} />;
}

export default function HomePage() {
  return getAppMode() === 'demo' ? <DemoHomePage /> : <ProductionHomePage />;
}
