'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminProduct } from './product-actions';
import { initialProductEditorState } from './product-editor-state';
import styles from '../requests/requests.module.css';

type Product = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'category_id' | 'option_set_id' | 'name_vi' | 'name_en' | 'description_vi' | 'description_en' | 'price_vnd' | 'image_url' | 'badge' | 'tasting_notes' | 'sort_order' | 'is_available' | 'is_published'>;
type Category = { id: string; name_vi: string };
type OptionSet = { id: string; name: string };

export default function ProductEditorForm({ product, categories, optionSets }: { product?: Product; categories: Category[]; optionSets: OptionSet[] }) {
  const [state, formAction, pending] = useActionState(upsertAdminProduct, initialProductEditorState);
  const id = product?.id ?? '';

  return (
    <form action={formAction} className={styles.productEditor}>
      <div className={styles.editorGrid}>
        <label>Mã sản phẩm<input name="productId" defaultValue={id} readOnly={Boolean(product)} placeholder="Tự tạo nếu để trống" /></label>
        <label>Danh mục<select name="categoryId" defaultValue={product?.category_id ?? categories[0]?.id ?? ''} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name_vi}</option>)}</select></label>
        <label>Tên tiếng Việt<input name="nameVi" defaultValue={product?.name_vi ?? ''} maxLength={160} required /></label>
        <label>Tên tiếng Anh<input name="nameEn" defaultValue={product?.name_en ?? ''} maxLength={160} required /></label>
        <label>Giá (VND)<input name="priceVnd" type="number" min="0" step="1000" defaultValue={product?.price_vnd ?? 0} required /></label>
        <label>Ảnh URL<input name="imageUrl" type="url" defaultValue={product?.image_url ?? ''} required /></label>
        <label>Option set<select name="optionSetId" defaultValue={product?.option_set_id ?? ''}><option value="">Không dùng</option>{optionSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
        <label>Badge<select name="badge" defaultValue={product?.badge ?? ''}><option value="">Không có</option><option value="best">Best</option><option value="seasonal">Seasonal</option><option value="new">New</option><option value="signature">Signature</option></select></label>
        <label>Thứ tự<input name="sortOrder" type="number" min="0" step="1" defaultValue={product?.sort_order ?? 0} required /></label>
        <label>Tasting notes<input name="tastingNotes" defaultValue={product?.tasting_notes ?? ''} maxLength={500} /></label>
      </div>
      <div className={styles.editorTextareas}>
        <label>Mô tả tiếng Việt<textarea name="descriptionVi" defaultValue={product?.description_vi ?? ''} maxLength={2000} rows={3} /></label>
        <label>Mô tả tiếng Anh<textarea name="descriptionEn" defaultValue={product?.description_en ?? ''} maxLength={2000} rows={3} /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isAvailable" defaultChecked={product?.is_available ?? true} /> Đang bán</label>
        <label><input type="checkbox" name="isPublished" defaultChecked={product?.is_published ?? false} /> Công khai</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span>{pending ? 'Đang lưu' : 'Lưu sản phẩm'}</span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
