import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import ProductDetailClient from './ProductDetailClient';
import { CATEGORIES, PRODUCTS, type Category, type Product } from '@/data/products';
import { getCatalog, getCatalogProduct } from '@/lib/catalog/queries';
import { getAppMode, getSiteUrl } from '@/lib/env';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

function ProductDetailNoScript({ product, category }: { product: Product; category?: Category }) {
  return (
    <main className="wrap noScriptContent">
      <p className="eyebrow eyebrow-green">Thực đơn Beanbus</p>
      <Link href="/menu">Quay lại thực đơn</Link>
      <article>
        <h1>{product.nameVi}</h1>
        {category && <p>{category.nameVi}</p>}
        <p>{product.descriptionVi}</p>
        {product.tastingNotes && <p>Hương vị: {product.tastingNotes}</p>}
        <p><strong>{product.price.toLocaleString('vi-VN')}đ</strong></p>
        <p>{product.isAvailable ? 'Đang phục vụ' : 'Tạm hết'}</p>
        <p><Link href="/order">Mở trang đặt đồ</Link></p>
      </article>
    </main>
  );
}

async function loadProduct(id: string): Promise<Product | null> {
  return getAppMode() === 'demo'
    ? PRODUCTS.find((product) => product.id === id) ?? null
    : getCatalogProduct(id);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) return { title: 'Không tìm thấy sản phẩm | Beanbus Coffee' };

  return {
    title: `${product.nameVi} | Beanbus Coffee`,
    description: product.descriptionVi,
    alternates: { canonical: `/menu/${product.id}` },
    openGraph: {
      title: product.nameVi,
      description: product.descriptionVi,
      url: `/menu/${product.id}`,
      images: [{ url: product.image, alt: product.nameVi }],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) notFound();

  const categories = getAppMode() === 'demo' ? CATEGORIES : (await getCatalog()).categories;
  const category = categories.find((item) => item.id === product.categoryId);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.nameVi,
    description: product.descriptionVi,
    image: [product.image],
    category: category?.nameVi,
    url: `${getSiteUrl()}/menu/${product.id}`,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'VND',
      availability: product.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <Script
        id="product-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <ProductDetailClient product={product} category={category} />
      <ProductDetailNoScript product={product} category={category} />
    </>
  );
}
