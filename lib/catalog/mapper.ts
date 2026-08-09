import type { Category, Product, ProductOption } from '@/data/products';
import type {
  CatalogCategoryRow,
  CatalogOptionRow,
  ProductRow,
} from '@/lib/supabase/database.types';

const PRODUCT_BADGES = new Set(['best', 'seasonal', 'new', 'signature']);
const OPTION_GROUPS = new Set(['size', 'sugar', 'ice', 'topping']);

export function mapCatalogCategory(
  row: Pick<CatalogCategoryRow, 'id' | 'name_vi' | 'name_en'>
): Category {
  return { id: row.id, nameVi: row.name_vi, nameEn: row.name_en };
}

export function mapCatalogOption(
  row: Pick<CatalogOptionRow, 'id' | 'group_name' | 'name_vi' | 'name_en' | 'extra_price_vnd'>
): ProductOption {
  if (!OPTION_GROUPS.has(row.group_name)) {
    throw new Error(`Unsupported catalog option group: ${row.group_name}`);
  }

  return {
    id: row.id,
    group: row.group_name,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    extraPrice: row.extra_price_vnd,
  };
}

export function mapCatalogProduct(
  row: Pick<
    ProductRow,
    | 'id'
    | 'category_id'
    | 'name_vi'
    | 'name_en'
    | 'description_vi'
    | 'description_en'
    | 'price_vnd'
    | 'image_url'
    | 'badge'
    | 'is_available'
    | 'tasting_notes'
  >,
  options: ProductOption[] = []
): Product {
  if (row.badge && !PRODUCT_BADGES.has(row.badge)) {
    throw new Error(`Unsupported product badge: ${row.badge}`);
  }

  return {
    id: row.id,
    categoryId: row.category_id,
    nameVi: row.name_vi,
    nameEn: row.name_en,
    descriptionVi: row.description_vi,
    descriptionEn: row.description_en,
    price: row.price_vnd,
    image: row.image_url,
    badge: row.badge ? row.badge as Product['badge'] : undefined,
    isAvailable: row.is_available,
    tastingNotes: row.tasting_notes ?? undefined,
    options: options.length > 0 ? options : undefined,
  };
}
