import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { CATEGORIES, PRODUCTS, type Product } from '@/data/products';
import { getCatalog, getCatalogProduct } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

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
    openGraph: {
      title: product.nameVi,
      description: product.descriptionVi,
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

  return <ProductDetailClient product={product} category={category} />;
}
