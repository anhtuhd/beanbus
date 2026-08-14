'use client';

import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, Eye, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';
import type { CatalogDraftMenu, CatalogDraftOption, CatalogDraftOptionGroup, CatalogDraftOptionSet, CatalogDraftProduct, CatalogDraftSection, CatalogSnapshot } from '@/lib/catalog/release';
import MediaUploader from '@/components/admin/MediaUploader';
import { initialCatalogReleaseActionState, publishCatalogDraft, saveCatalogDraft } from './release-actions';
import styles from './MenuBuilder.module.css';

const DAYS = ['Chủ nhật / Sun', 'Thứ hai / Mon', 'Thứ ba / Tue', 'Thứ tư / Wed', 'Thứ năm / Thu', 'Thứ sáu / Fri', 'Thứ bảy / Sat'];

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'menu';
}

function newMenu(index: number, snapshot: CatalogSnapshot): CatalogDraftMenu {
  const id = `${slugify(`menu-${index}`)}-${Date.now().toString(36)}`;
  return {
    id,
    slug: id,
    nameVi: `Menu mới ${index}`,
    nameEn: `New menu ${index}`,
    sortOrder: index * 10,
    isActive: true,
    schedules: [],
    sections: snapshot.categories.filter((category) => category.isActive).map((category, sectionIndex) => ({ id: `${id}-${category.id}`, categoryId: category.id, sortOrder: sectionIndex * 10, productIds: [] })),
  };
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (index < 0 || next < 0 || next >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

function blankProduct(categoryId: string, id = 'new-product'): CatalogDraftProduct {
  return {
    id,
    categoryId,
    optionSetId: null,
    nameVi: '',
    nameEn: '',
    descriptionVi: '',
    descriptionEn: '',
    priceVnd: 0,
    imageUrl: '',
    badge: null,
    tastingNotes: null,
    isAvailable: true,
    isPublished: false,
    sortOrder: 0,
  };
}

function validateSchedules(snapshot: CatalogSnapshot): string | null {
  for (const menu of snapshot.menus) {
    for (let day = 0; day < 7; day += 1) {
      const intervals = menu.schedules.filter((schedule) => schedule.dayOfWeek === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      for (let index = 0; index < intervals.length; index += 1) {
        const current = intervals[index];
        if (current.startsAt >= current.endsAt) return `Khung giờ của ${menu.nameVi} không hợp lệ.`;
        const previous = intervals[index - 1];
        if (previous && previous.endsAt > current.startsAt) return `Khung giờ ${DAYS[day]} của ${menu.nameVi} đang bị chồng.`;
      }
    }
  }
  return null;
}

export default function MenuBuilder({ initialSnapshot, initialLockVersion }: { initialSnapshot: CatalogSnapshot; initialLockVersion: number }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [lockVersion, setLockVersion] = useState(initialLockVersion);
  const [activeMenuId, setActiveMenuId] = useState(initialSnapshot.menus[0]?.id ?? '');
  const [saveState, saveAction, saving] = useActionState(saveCatalogDraft, initialCatalogReleaseActionState);
  const [publishState, publishAction, publishing] = useActionState(publishCatalogDraft, initialCatalogReleaseActionState);
  const [validationError, setValidationError] = useState('');
  const [mediaUploads, setMediaUploads] = useState<Array<{ targetProductId: string; publicUrl: string; stagingKey: string; finalKey: string; contentLength: number }>>([]);
  const [newProductId, setNewProductId] = useState('new-product');
  const [newProduct, setNewProduct] = useState(() => blankProduct(initialSnapshot.categories[0]?.id ?? ''));
  const [selectedProductId, setSelectedProductId] = useState(initialSnapshot.products[0]?.id ?? '');
  const activeMenu = useMemo(() => snapshot.menus.find((menu) => menu.id === activeMenuId) ?? snapshot.menus[0], [activeMenuId, snapshot.menus]);
  const selectedProduct = snapshot.products.find((product) => product.id === selectedProductId) ?? snapshot.products[0];
  const actionState = publishState.status !== 'idle' ? publishState : saveState;
  const effectiveLockVersion = saveState.lockVersion ?? publishState.lockVersion ?? lockVersion;

  function updateMenu(menuId: string, update: Partial<CatalogDraftMenu>) {
    setSnapshot((current) => ({ ...current, menus: current.menus.map((menu) => menu.id === menuId ? { ...menu, ...update } : menu) }));
  }

  function updateSection(menuId: string, sectionId: string, update: Partial<CatalogDraftSection>) {
    setSnapshot((current) => ({ ...current, menus: current.menus.map((menu) => menu.id === menuId ? { ...menu, sections: menu.sections.map((section) => section.id === sectionId ? { ...section, ...update } : section) } : menu) }));
  }

  function addMenu() {
    const menu = newMenu(snapshot.menus.length + 1, snapshot);
    setSnapshot((current) => ({ ...current, menus: [...current.menus, menu] }));
    setActiveMenuId(menu.id);
  }

  function addSection() {
    if (!activeMenu) return;
    const category = snapshot.categories.find((item) => item.isActive && !activeMenu.sections.some((section) => section.categoryId === item.id));
    if (!category) return;
    updateMenu(activeMenu.id, { sections: [...activeMenu.sections, { id: `${activeMenu.id}-${category.id}`, categoryId: category.id, sortOrder: activeMenu.sections.length * 10, productIds: [] }] });
  }

  function updateCategory(id: string, key: 'nameVi' | 'nameEn' | 'isActive', value: string | boolean) {
    setSnapshot((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, [key]: value } : category) }));
  }

  function updateProduct(id: string, update: Partial<CatalogDraftProduct>) {
    setSnapshot((current) => ({ ...current, products: current.products.map((product) => product.id === id ? { ...product, ...update } : product) }));
  }

  function updateOptionSet(id: string, update: Partial<CatalogDraftOptionSet>) {
    setSnapshot((current) => ({ ...current, optionSets: current.optionSets.map((optionSet) => optionSet.id === id ? { ...optionSet, ...update } : optionSet) }));
  }

  function updateOptionGroup(optionSetId: string, groupId: string, update: Partial<CatalogDraftOptionGroup>) {
    setSnapshot((current) => ({ ...current, optionSets: current.optionSets.map((optionSet) => optionSet.id === optionSetId ? { ...optionSet, groups: optionSet.groups.map((group) => group.id === groupId ? { ...group, ...update } : group) } : optionSet) }));
  }

  function updateOption(optionSetId: string, groupId: string, optionId: string, update: Partial<CatalogDraftOption>) {
    setSnapshot((current) => ({ ...current, optionSets: current.optionSets.map((optionSet) => optionSet.id === optionSetId ? { ...optionSet, groups: optionSet.groups.map((group) => group.id === groupId ? { ...group, options: group.options.map((option) => option.id === optionId ? { ...option, ...update } : option) } : group) } : optionSet) }));
  }

  function addProductToDraft() {
    if (!newProduct.nameVi.trim() || !newProduct.nameEn.trim() || !newProduct.imageUrl || !newProduct.categoryId) {
      setValidationError('Món mới cần đủ tên VI, tên EN, danh mục và ảnh đã crop.');
      return;
    }
    if (snapshot.products.some((product) => product.id === newProductId)) {
      setValidationError('Mã món mới đã tồn tại. Hãy thử lại.');
      return;
    }
    const sortOrder = Math.max(0, ...snapshot.products.map((product) => product.sortOrder)) + 10;
    const product = { ...newProduct, id: newProductId, sortOrder };
    setSnapshot((current) => ({ ...current, products: [...current.products, product] }));
    setSelectedProductId(product.id);
    setNewProductId(`new-${crypto.randomUUID()}`);
    setNewProduct(blankProduct(snapshot.categories[0]?.id ?? ''));
    setValidationError('');
  }

  return (
    <div className={styles.builder}>
      <div className={styles.builderTopbar}>
        <div><strong>Menu Builder</strong><span>Draft v{effectiveLockVersion} · Asia/Ho_Chi_Minh</span></div>
        <div className={styles.topActions}>
          <Link href="/admin/catalog/preview" className={styles.secondary}><Eye size={15} /> Preview</Link>
          <button form="catalog-draft-form" type="submit" className="btn btn-primary" disabled={saving}><Save size={15} /> {saving ? 'Saving...' : 'Save draft'}</button>
          <form action={publishAction} className={styles.inlineForm} onSubmit={() => setLockVersion(effectiveLockVersion)}>
            <input type="hidden" name="lockVersion" value={effectiveLockVersion} />
            <button type="submit" className={styles.publishButton} disabled={publishing}><Send size={15} /> {publishing ? 'Publishing...' : 'Publish'}</button>
          </form>
        </div>
      </div>

      {actionState.status !== 'idle' && <p className={actionState.status === 'error' ? styles.error : styles.success} role={actionState.status === 'error' ? 'alert' : 'status'}>{actionState.status === 'success' ? <Check size={15} /> : null}{actionState.message}</p>}

      {validationError && <p className={styles.error} role="alert">{validationError}</p>}
      <form id="catalog-draft-form" action={saveAction} onSubmit={(event) => { const error = validateSchedules(snapshot); setValidationError(error ?? ''); if (error) event.preventDefault(); }}>
        <input type="hidden" name="lockVersion" value={effectiveLockVersion} />
        <input type="hidden" name="snapshot" value={JSON.stringify(snapshot)} readOnly />
        <input type="hidden" name="mediaUploads" value={JSON.stringify(mediaUploads)} readOnly />
        <div className={styles.builderGrid}>
          <section className={styles.panel} aria-labelledby="menus-heading">
            <div className={styles.panelHeading}><div><h2 id="menus-heading">Menus / Khung menu</h2><p>Chọn menu theo giờ cho khách hàng.</p></div><button type="button" className={styles.iconButton} onClick={addMenu} title="Thêm menu"><Plus size={16} /></button></div>
            <div className={styles.menuList}>
              {snapshot.menus.map((menu) => <button type="button" key={menu.id} className={`${styles.menuTab} ${activeMenu?.id === menu.id ? styles.active : ''}`} onClick={() => setActiveMenuId(menu.id)}><span>{menu.nameVi}<small>{menu.nameEn}</small></span><span className={menu.isActive ? styles.activeDot : styles.mutedDot} aria-label={menu.isActive ? 'Active' : 'Inactive'} /></button>)}
            </div>
            {activeMenu && <div className={styles.menuEditor}>
              <label>Tên menu VI<input value={activeMenu.nameVi} onChange={(event) => updateMenu(activeMenu.id, { nameVi: event.target.value })} maxLength={120} /></label>
              <label>Menu name EN<input value={activeMenu.nameEn} onChange={(event) => updateMenu(activeMenu.id, { nameEn: event.target.value })} maxLength={120} /></label>
              <label>Slug<input value={activeMenu.slug} onChange={(event) => updateMenu(activeMenu.id, { slug: slugify(event.target.value) })} maxLength={80} /></label>
              <label className={styles.checkbox}><input type="checkbox" checked={activeMenu.isActive} onChange={(event) => updateMenu(activeMenu.id, { isActive: event.target.checked })} /> Đang hoạt động / Active</label>
              <div className={styles.scheduleBlock}>
                <div className={styles.subHeading}><strong>Giờ hoạt động / Schedule</strong><button type="button" className={styles.secondary} onClick={() => updateMenu(activeMenu.id, { schedules: [...activeMenu.schedules, { dayOfWeek: 1, startsAt: '07:00', endsAt: '23:00' }] })}><Plus size={14} /> Thêm khung giờ</button></div>
                {activeMenu.schedules.map((schedule, index) => <div key={`${schedule.dayOfWeek}-${index}`} className={styles.scheduleRow}>
                  <select aria-label="Ngày trong tuần" value={schedule.dayOfWeek} onChange={(event) => updateMenu(activeMenu.id, { schedules: activeMenu.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, dayOfWeek: Number(event.target.value) } : item) })}>{DAYS.map((day, dayIndex) => <option key={dayIndex} value={dayIndex}>{day}</option>)}</select>
                  <input aria-label="Giờ bắt đầu" type="time" value={schedule.startsAt} onChange={(event) => updateMenu(activeMenu.id, { schedules: activeMenu.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, startsAt: event.target.value } : item) })} />
                  <span>to</span>
                  <input aria-label="Giờ kết thúc" type="time" value={schedule.endsAt} onChange={(event) => updateMenu(activeMenu.id, { schedules: activeMenu.schedules.map((item, itemIndex) => itemIndex === index ? { ...item, endsAt: event.target.value } : item) })} />
                  <button type="button" className={styles.iconButton} onClick={() => updateMenu(activeMenu.id, { schedules: activeMenu.schedules.filter((_, itemIndex) => itemIndex !== index) })} title="Xóa khung giờ"><Trash2 size={15} /></button>
                </div>)}
                {!activeMenu.schedules.length && <p className={styles.empty}>Chưa có lịch. Menu sẽ không hiển thị ngoài giờ.</p>}
              </div>
            </div>}
          </section>

          <section className={styles.panel} aria-labelledby="sections-heading">
            <div className={styles.panelHeading}><div><h2 id="sections-heading">Sections / Danh mục</h2><p>Một món có thể xuất hiện trong nhiều menu.</p></div><button type="button" className={styles.secondary} onClick={addSection} disabled={!activeMenu}><Plus size={14} /> Thêm section</button></div>
            {activeMenu?.sections.map((section, sectionIndex) => {
              const category = snapshot.categories.find((item) => item.id === section.categoryId);
              const products = snapshot.products.filter((product) => product.categoryId === section.categoryId);
              return <div key={section.id} className={styles.sectionEditor}>
                <div className={styles.sectionHeader}><select value={section.categoryId} onChange={(event) => updateSection(activeMenu.id, section.id, { categoryId: event.target.value, productIds: [] })}>{snapshot.categories.map((item) => <option key={item.id} value={item.id}>{item.nameVi} / {item.nameEn}</option>)}</select><div className={styles.reorder}><button type="button" className={styles.iconButton} onClick={() => updateMenu(activeMenu.id, { sections: move(activeMenu.sections, sectionIndex, -1) })} title="Đưa lên"><ChevronUp size={15} /></button><button type="button" className={styles.iconButton} onClick={() => updateMenu(activeMenu.id, { sections: move(activeMenu.sections, sectionIndex, 1) })} title="Đưa xuống"><ChevronDown size={15} /></button></div></div>
                <p className={styles.sectionMeta}>{category?.nameEn ?? 'Section'} · {section.productIds.length} món đã chọn</p>
                <div className={styles.productChecks}>{products.map((product) => <label key={product.id} className={styles.productCheck}><input type="checkbox" checked={section.productIds.includes(product.id)} onChange={(event) => updateSection(activeMenu.id, section.id, { productIds: event.target.checked ? [...section.productIds, product.id] : section.productIds.filter((id) => id !== product.id) })} /><span>{product.nameVi}<small>{product.priceVnd.toLocaleString('vi-VN')}đ · {product.isAvailable ? 'Đang bán' : 'Hết món'}</small></span></label>)}</div>
              </div>;
            })}
            {!activeMenu?.sections.length && <p className={styles.empty}>Menu chưa có section.</p>}
          </section>
        </div>

        <section className={styles.panel} aria-labelledby="categories-heading">
          <div className={styles.panelHeading}><div><h2 id="categories-heading">Categories / Danh mục món</h2><p>Đổi tên VI/EN tại đây; chỉnh món và giá ở tab Món.</p></div></div>
          <div className={styles.categoryGrid}>{snapshot.categories.map((category) => <div key={category.id} className={styles.categoryRow}><span className={styles.categoryId}>{category.id}</span><input aria-label={`Tên VI ${category.id}`} value={category.nameVi} onChange={(event) => updateCategory(category.id, 'nameVi', event.target.value)} /><input aria-label={`Name EN ${category.id}`} value={category.nameEn} onChange={(event) => updateCategory(category.id, 'nameEn', event.target.value)} /><label className={styles.checkbox}><input type="checkbox" checked={category.isActive} onChange={(event) => updateCategory(category.id, 'isActive', event.target.checked)} /> Active</label></div>)}</div>
        </section>
      </form>
      <p className={styles.builderHint}>Lưu bản nháp trước khi xuất bản. Nếu có người khác đã lưu, hệ thống sẽ yêu cầu tải lại để tránh ghi đè.</p>
      <section className={styles.panel} aria-labelledby="new-product-heading">
        <div className={styles.panelHeading}><div><h2 id="new-product-heading">Add item / Thêm món</h2><p>Món mới chỉ vào catalog production sau khi bản nháp được xuất bản.</p></div></div>
        <div className={styles.draftProductGrid}>
          <label>Tên VI<input value={newProduct.nameVi} onChange={(event) => setNewProduct((current) => ({ ...current, nameVi: event.target.value }))} maxLength={160} /></label>
          <label>Name EN<input value={newProduct.nameEn} onChange={(event) => setNewProduct((current) => ({ ...current, nameEn: event.target.value }))} maxLength={160} /></label>
          <label>Giá VND<input type="number" min="0" step="1000" value={newProduct.priceVnd} onChange={(event) => setNewProduct((current) => ({ ...current, priceVnd: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label>Danh mục<select value={newProduct.categoryId} onChange={(event) => setNewProduct((current) => ({ ...current, categoryId: event.target.value }))}>{snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.nameVi} / {category.nameEn}</option>)}</select></label>
          <label>Mô tả VI<textarea value={newProduct.descriptionVi} onChange={(event) => setNewProduct((current) => ({ ...current, descriptionVi: event.target.value }))} maxLength={2000} rows={2} /></label>
          <label>Description EN<textarea value={newProduct.descriptionEn} onChange={(event) => setNewProduct((current) => ({ ...current, descriptionEn: event.target.value }))} maxLength={2000} rows={2} /></label>
          <label>Modifier<select value={newProduct.optionSetId ?? ''} onChange={(event) => setNewProduct((current) => ({ ...current, optionSetId: event.target.value || null }))}><option value="">Không dùng / None</option>{snapshot.optionSets.map((optionSet) => <option key={optionSet.id} value={optionSet.id}>{optionSet.nameVi} / {optionSet.nameEn}</option>)}</select></label>
          <label>Badge<select value={newProduct.badge ?? ''} onChange={(event) => setNewProduct((current) => ({ ...current, badge: event.target.value || null }))}><option value="">Không có / None</option><option value="best">Best</option><option value="seasonal">Seasonal</option><option value="new">New</option><option value="signature">Signature</option></select></label>
        </div>
        <MediaUploader key={newProductId} kind="product" name="newProductImage" onUploaded={(media) => { setNewProduct((current) => ({ ...current, imageUrl: media.publicUrl })); setMediaUploads((current) => [...current.filter((item) => item.targetProductId !== newProductId), { targetProductId: newProductId, ...media }]); }} />
        <button type="button" className={styles.secondary} onClick={addProductToDraft}><Plus size={15} /> Thêm vào bản nháp</button>
      </section>
      {selectedProduct && <section id="product-library" className={styles.panel} aria-labelledby="product-library-heading">
        <div className={styles.panelHeading}><div><h2 id="product-library-heading">Product library / Thư viện món</h2><p>Tên, giá và ảnh chỉ thay đổi menu sau khi xuất bản.</p></div></div>
        <div className={styles.productLibrary}>
          <label>Chọn món / Select item<select value={selectedProduct.id} onChange={(event) => setSelectedProductId(event.target.value)}>{snapshot.products.map((product) => <option key={product.id} value={product.id}>{product.nameVi} · {product.id}</option>)}</select></label>
          <div className={styles.draftProductGrid}>
            <label>Tên VI<input value={selectedProduct.nameVi} onChange={(event) => updateProduct(selectedProduct.id, { nameVi: event.target.value })} maxLength={160} /></label>
            <label>Name EN<input value={selectedProduct.nameEn} onChange={(event) => updateProduct(selectedProduct.id, { nameEn: event.target.value })} maxLength={160} /></label>
            <label>Giá VND<input type="number" min="0" step="1000" value={selectedProduct.priceVnd} onChange={(event) => updateProduct(selectedProduct.id, { priceVnd: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label>Danh mục<select value={selectedProduct.categoryId} onChange={(event) => updateProduct(selectedProduct.id, { categoryId: event.target.value })}>{snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.nameVi} / {category.nameEn}</option>)}</select></label>
            <label>Mô tả VI<textarea value={selectedProduct.descriptionVi} onChange={(event) => updateProduct(selectedProduct.id, { descriptionVi: event.target.value })} maxLength={2000} rows={2} /></label>
            <label>Description EN<textarea value={selectedProduct.descriptionEn} onChange={(event) => updateProduct(selectedProduct.id, { descriptionEn: event.target.value })} maxLength={2000} rows={2} /></label>
            <label>Modifier<select value={selectedProduct.optionSetId ?? ''} onChange={(event) => updateProduct(selectedProduct.id, { optionSetId: event.target.value || null })}><option value="">Không dùng / None</option>{snapshot.optionSets.map((optionSet) => <option key={optionSet.id} value={optionSet.id}>{optionSet.nameVi} / {optionSet.nameEn}</option>)}</select></label>
            <label>Badge<select value={selectedProduct.badge ?? ''} onChange={(event) => updateProduct(selectedProduct.id, { badge: event.target.value || null })}><option value="">Không có / None</option><option value="best">Best</option><option value="seasonal">Seasonal</option><option value="new">New</option><option value="signature">Signature</option></select></label>
            <label>Tasting notes<input value={selectedProduct.tastingNotes ?? ''} onChange={(event) => updateProduct(selectedProduct.id, { tastingNotes: event.target.value || null })} maxLength={500} /></label>
          </div>
          <MediaUploader key={selectedProduct.id} kind="product" name="draftProductImage" defaultValue={selectedProduct.imageUrl} onUploaded={(media) => { setSnapshot((current) => ({ ...current, products: current.products.map((product) => product.id === selectedProduct.id ? { ...product, imageUrl: media.publicUrl } : product) })); setMediaUploads((current) => [...current.filter((item) => item.targetProductId !== selectedProduct.id), { targetProductId: selectedProduct.id, ...media }]); }} />
        </div>
      </section>}
      <section className={styles.panel} aria-labelledby="options-heading">
        <div className={styles.panelHeading}><div><h2 id="options-heading">Modifiers / Tuỳ chọn</h2><p>Nhóm modifier dùng lại cho nhiều món; giới hạn chọn được kiểm tra khi xuất bản và đặt hàng.</p></div></div>
        <div className={styles.optionSets}>
          {snapshot.optionSets.map((optionSet) => <div key={optionSet.id} className={styles.optionSet}>
            <div className={styles.optionSetHeading}><input aria-label={`Tên bộ tuỳ chọn ${optionSet.id}`} value={optionSet.nameVi} onChange={(event) => updateOptionSet(optionSet.id, { nameVi: event.target.value, name: event.target.value })} /><input aria-label={`Option set name ${optionSet.id}`} value={optionSet.nameEn} onChange={(event) => updateOptionSet(optionSet.id, { nameEn: event.target.value })} /><label className={styles.checkbox}><input type="checkbox" checked={optionSet.isActive} onChange={(event) => updateOptionSet(optionSet.id, { isActive: event.target.checked })} /> Active</label></div>
            {optionSet.groups.map((group) => <div key={group.id} className={styles.optionGroup}>
              <div className={styles.optionGroupHeading}><div><strong>{group.groupName}</strong><input aria-label={`Tên nhóm ${group.id}`} value={group.nameVi} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { nameVi: event.target.value })} /><input aria-label={`Group name ${group.id}`} value={group.nameEn} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { nameEn: event.target.value })} /></div><label className={styles.checkbox}><input type="checkbox" checked={group.isActive} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { isActive: event.target.checked })} /> Active</label></div>
              <div className={styles.optionMeta}><label>Min<input type="number" min="0" value={group.minSelections} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { minSelections: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Max<input type="number" min={group.minSelections} value={group.maxSelections} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { maxSelections: Math.max(group.minSelections, Number(event.target.value) || 0) })} /></label><label className={styles.checkbox}><input type="checkbox" checked={group.allowMultiple} onChange={(event) => updateOptionGroup(optionSet.id, group.id, { allowMultiple: event.target.checked })} /> Cho nhiều</label></div>
              <div className={styles.optionRows}>{group.options.map((option) => <div key={option.id} className={styles.optionRow}><input aria-label={`Tên tuỳ chọn ${option.id}`} value={option.nameVi} onChange={(event) => updateOption(optionSet.id, group.id, option.id, { nameVi: event.target.value })} /><input aria-label={`Option name ${option.id}`} value={option.nameEn} onChange={(event) => updateOption(optionSet.id, group.id, option.id, { nameEn: event.target.value })} /><input aria-label={`Giá thêm ${option.id}`} type="number" min="0" value={option.extraPriceVnd} onChange={(event) => updateOption(optionSet.id, group.id, option.id, { extraPriceVnd: Math.max(0, Number(event.target.value) || 0) })} /><label className={styles.checkbox}><input type="checkbox" checked={option.isDefault} onChange={(event) => updateOption(optionSet.id, group.id, option.id, { isDefault: event.target.checked })} /> Mặc định</label></div>)}</div>
            </div>)}
          </div>)}
        </div>
      </section>
    </div>
  );
}
