import type { Json } from '@/lib/supabase/database.types';

export type CatalogDraftCategory = {
  id: string;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
};

export type CatalogDraftOption = {
  id: string;
  groupName: string;
  nameVi: string;
  nameEn: string;
  extraPriceVnd: number;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
};

export type CatalogDraftOptionGroup = {
  id: string;
  groupName: 'size' | 'sugar' | 'ice' | 'topping';
  nameVi: string;
  nameEn: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  allowMultiple: boolean;
  sortOrder: number;
  isActive: boolean;
  options: CatalogDraftOption[];
};

export type CatalogDraftOptionSet = {
  id: string;
  name: string;
  nameVi: string;
  nameEn: string;
  isActive: boolean;
  groups: CatalogDraftOptionGroup[];
};

export type CatalogDraftProduct = {
  id: string;
  categoryId: string;
  optionSetId: string | null;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  priceVnd: number;
  imageUrl: string;
  badge: string | null;
  tastingNotes: string | null;
  isAvailable: boolean;
  isPublished: boolean;
  sortOrder: number;
};

export type CatalogDraftSchedule = {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

export type CatalogDraftSection = {
  id: string;
  categoryId: string;
  sortOrder: number;
  productIds: string[];
};

export type CatalogDraftMenu = {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  schedules: CatalogDraftSchedule[];
  sections: CatalogDraftSection[];
};

export type CatalogSnapshot = {
  schemaVersion: 1;
  categories: CatalogDraftCategory[];
  optionSets: CatalogDraftOptionSet[];
  products: CatalogDraftProduct[];
  menus: CatalogDraftMenu[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseCatalogSnapshot(value: unknown): CatalogSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const optionSets = Array.isArray(value.optionSets) ? value.optionSets : [];
  const products = Array.isArray(value.products) ? value.products : [];
  const menus = Array.isArray(value.menus) ? value.menus : [];

  const parsedCategories: CatalogDraftCategory[] = [];
  for (const item of categories) {
    if (!isRecord(item)) return null;
    const id = stringValue(item.id);
    const nameVi = stringValue(item.nameVi);
    const nameEn = stringValue(item.nameEn);
    if (!id || !nameVi || !nameEn) return null;
    parsedCategories.push({ id, nameVi, nameEn, sortOrder: Math.max(0, Math.floor(numberValue(item.sortOrder))), isActive: booleanValue(item.isActive, true) });
  }

  const parsedOptionSets: CatalogDraftOptionSet[] = [];
  for (const item of optionSets) {
    if (!isRecord(item)) return null;
    const id = stringValue(item.id);
    const name = stringValue(item.name) ?? stringValue(item.nameVi);
    const nameVi = stringValue(item.nameVi) ?? name;
    const nameEn = stringValue(item.nameEn) ?? name;
    if (!id || !name || !nameVi || !nameEn) return null;
    const groups: CatalogDraftOptionGroup[] = [];
    for (const group of Array.isArray(item.groups) ? item.groups : []) {
      if (!isRecord(group)) return null;
      const groupId = stringValue(group.id);
      const groupName = stringValue(group.groupName);
      const groupNameVi = stringValue(group.nameVi);
      const groupNameEn = stringValue(group.nameEn);
      if (!groupId || !groupName || !groupNameVi || !groupNameEn || !['size', 'sugar', 'ice', 'topping'].includes(groupName)) return null;
      const options: CatalogDraftOption[] = [];
      for (const option of Array.isArray(group.options) ? group.options : []) {
        if (!isRecord(option)) return null;
        const optionId = stringValue(option.id);
        const optionNameVi = stringValue(option.nameVi);
        const optionNameEn = stringValue(option.nameEn);
        if (!optionId || !optionNameVi || !optionNameEn) return null;
        options.push({ id: optionId, groupName, nameVi: optionNameVi, nameEn: optionNameEn, extraPriceVnd: Math.max(0, Math.floor(numberValue(option.extraPriceVnd))), sortOrder: Math.max(0, Math.floor(numberValue(option.sortOrder))), isActive: booleanValue(option.isActive, true), isDefault: booleanValue(option.isDefault, false) });
      }
      const minSelections = Math.max(0, Math.floor(numberValue(group.minSelections)));
      const maxSelections = Math.max(minSelections, Math.floor(numberValue(group.maxSelections, 1)));
      groups.push({ id: groupId, groupName: groupName as CatalogDraftOptionGroup['groupName'], nameVi: groupNameVi, nameEn: groupNameEn, isRequired: booleanValue(group.isRequired, false), minSelections, maxSelections, allowMultiple: booleanValue(group.allowMultiple, false), sortOrder: Math.max(0, Math.floor(numberValue(group.sortOrder))), isActive: booleanValue(group.isActive, true), options });
    }
    parsedOptionSets.push({ id, name, nameVi, nameEn, isActive: booleanValue(item.isActive, true), groups });
  }

  const parsedProducts: CatalogDraftProduct[] = [];
  for (const item of products) {
    if (!isRecord(item)) return null;
    const id = stringValue(item.id);
    const categoryId = stringValue(item.categoryId);
    const nameVi = stringValue(item.nameVi);
    const nameEn = stringValue(item.nameEn);
    const imageUrl = stringValue(item.imageUrl);
    if (!id || !categoryId || !nameVi || !nameEn || !imageUrl) return null;
    parsedProducts.push({ id, categoryId, optionSetId: stringValue(item.optionSetId), nameVi, nameEn, descriptionVi: typeof item.descriptionVi === 'string' ? item.descriptionVi : '', descriptionEn: typeof item.descriptionEn === 'string' ? item.descriptionEn : '', priceVnd: Math.max(0, Math.floor(numberValue(item.priceVnd))), imageUrl, badge: stringValue(item.badge), tastingNotes: stringValue(item.tastingNotes), isAvailable: booleanValue(item.isAvailable, true), isPublished: booleanValue(item.isPublished, false), sortOrder: Math.max(0, Math.floor(numberValue(item.sortOrder))) });
  }

  const parsedMenus: CatalogDraftMenu[] = [];
  for (const item of menus) {
    if (!isRecord(item)) return null;
    const id = stringValue(item.id);
    const slug = stringValue(item.slug);
    const nameVi = stringValue(item.nameVi);
    const nameEn = stringValue(item.nameEn);
    if (!id || !slug || !nameVi || !nameEn) return null;
    const schedules = (Array.isArray(item.schedules) ? item.schedules : []).map((schedule) => {
      if (!isRecord(schedule)) return null;
      const startsAt = stringValue(schedule.startsAt);
      const endsAt = stringValue(schedule.endsAt);
      const dayOfWeek = Math.floor(numberValue(schedule.dayOfWeek, -1));
      if (!startsAt || !endsAt || dayOfWeek < 0 || dayOfWeek > 6 || !/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt)) return null;
      return { dayOfWeek, startsAt, endsAt };
    });
    if (schedules.some((schedule) => schedule === null)) return null;
    const sections: CatalogDraftSection[] = [];
    for (const section of Array.isArray(item.sections) ? item.sections : []) {
      if (!isRecord(section)) return null;
      const sectionId = stringValue(section.id);
      const categoryId = stringValue(section.categoryId);
      const productIds = Array.isArray(section.productIds) && section.productIds.every((id) => typeof id === 'string') ? section.productIds as string[] : null;
      if (!sectionId || !categoryId || !productIds) return null;
      sections.push({ id: sectionId, categoryId, sortOrder: Math.max(0, Math.floor(numberValue(section.sortOrder))), productIds });
    }
    parsedMenus.push({ id, slug, nameVi, nameEn, sortOrder: Math.max(0, Math.floor(numberValue(item.sortOrder))), isActive: booleanValue(item.isActive, true), schedules: schedules as CatalogDraftSchedule[], sections });
  }

  return { schemaVersion: 1, categories: parsedCategories, optionSets: parsedOptionSets, products: parsedProducts, menus: parsedMenus };
}

export function asCatalogJson(snapshot: CatalogSnapshot): Json {
  return snapshot as unknown as Json;
}
