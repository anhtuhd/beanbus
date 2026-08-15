'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import type { Product, ProductOption } from '@/data/products';
import { claimCounterVoucher, createAdminAssistedOrder, createCounterOrder, createPendingMember, searchAdminOrderMembers, searchPosMembers, type AdminOrderMember } from './actions';
import pageStyles from './admin-order-new.module.css';
import MemberPassResolver from '@/app/pos/MemberPassResolver';

type Target = 'member' | 'guest';
type CartLine = {
  id: string;
  product: Product;
  optionIds: string[];
  quantity: number;
  specialNote: string;
};

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function defaultPickup(): string {
  const value = new Date(Date.now() + 30 * 60 * 1000);
  value.setSeconds(0, 0);
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function optionLabel(option: ProductOption): string {
  return `${option.nameVi}${option.extraPrice > 0 ? ` (+${formatMoney(option.extraPrice)})` : ''}`;
}

export default function AdminOrderCreator({
  products,
  initialMember,
  sepayEnabled,
  pointsEnabled,
  mode = 'admin',
}: {
  products: Product[];
  initialMember: AdminOrderMember | null;
  sepayEnabled: boolean;
  pointsEnabled: boolean;
  mode?: 'admin' | 'pos';
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Target>(initialMember ? 'member' : 'guest');
  const [member, setMember] = useState<AdminOrderMember | null>(initialMember);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<AdminOrderMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [searching, setSearching] = useState(false);
  const [customerName, setCustomerName] = useState(initialMember?.fullName ?? '');
  const [customerPhone, setCustomerPhone] = useState(initialMember?.phone ?? '');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [pickupAt, setPickupAt] = useState(defaultPickup);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [note, setNote] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState('');
  const [voucherConsentConfirmed, setVoucherConsentConfirmed] = useState(false);
  const [voucherConsentNote, setVoucherConsentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'sepay_qr'>('cod');
  const [pointsToApply, setPointsToApply] = useState('');
  const [pointsConsentConfirmed, setPointsConsentConfirmed] = useState(false);
  const [pointsConsentNote, setPointsConsentNote] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const selectedProduct = products.find((product) => product.id === productId) ?? products[0];
  const subtotal = useMemo(() => cart.reduce((total, line) => {
    const optionsTotal = line.product.options?.filter((option) => line.optionIds.includes(option.id)).reduce((sum, option) => sum + option.extraPrice, 0) ?? 0;
    return total + (line.product.price + optionsTotal) * line.quantity;
  }, 0), [cart]);
  const points = Math.max(0, Number(pointsToApply) || 0);
  const consentRequired = points > 0;

  function handleProductChange(value: string) {
    setProductId(value);
    const product = products.find((item) => item.id === value);
    const defaultSize = product?.options?.find((option) => option.group === 'size' && option.id.includes('m'));
    setOptionIds(defaultSize ? [defaultSize.id] : []);
  }

  function toggleOption(option: ProductOption) {
    setOptionIds((current) => option.group === 'size' || option.group === 'sugar' || option.group === 'ice'
      ? [...current.filter((id) => selectedProduct.options?.find((item) => item.id === id)?.group !== option.group), option.id]
      : current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]);
  }

  function addLine() {
    if (!selectedProduct) return;
    const key = `${selectedProduct.id}:${[...optionIds].sort().join(',')}:${specialNote.trim()}`;
    setCart((current) => {
      const existing = current.find((line) => line.id === key);
      if (existing) return current.map((line) => line.id === key ? { ...line, quantity: Math.min(20, line.quantity + quantity) } : line);
      return [...current, { id: key, product: selectedProduct, optionIds: [...optionIds], quantity, specialNote: specialNote.trim() }];
    });
    setQuantity(1);
    setSpecialNote('');
  }

  async function searchMembers() {
    if (memberQuery.trim().length < 2) return;
    setSearching(true);
    try {
      setMemberResults(await (mode === 'pos' ? searchPosMembers(memberQuery) : searchAdminOrderMembers(memberQuery)));
    } catch {
      setMemberResults([]);
    } finally {
      setSearching(false);
    }
  }

  function chooseTarget(next: Target) {
    setTarget(next);
    setMemberResults([]);
    if (next === 'guest') {
      setMember(null);
      setPointsToApply('');
      setPointsConsentConfirmed(false);
      setPointsConsentNote('');
      setVoucherConsentConfirmed(false);
      setVoucherConsentNote('');
    }
  }

  function chooseMember(next: AdminOrderMember) {
    setTarget('member');
    setMember(next);
    setCustomerName(next.fullName ?? '');
    setCustomerPhone(next.phone ?? next.pendingPhone ?? '');
    setMemberResults([]);
    setMemberQuery('');
    setVoucherMessage('');
    setVoucherConsentConfirmed(false);
    setVoucherConsentNote('');
  }

  async function claimVoucherAtCounter() {
    if (!member || !voucherCode.trim()) return;
    if (!voucherConsentConfirmed || voucherConsentNote.trim().length < 10) {
      setVoucherMessage('Hãy xác nhận hội viên đồng ý và nhập lý do lấy voucher từ 10 ký tự.');
      return;
    }
    const result = await claimCounterVoucher(member.id, voucherCode, voucherConsentNote);
    setVoucherMessage(result.ok ? (result.claimed ? 'Đã thêm voucher vào ví hội viên.' : 'Voucher này đã có trong ví hội viên.') : result.error);
  }

  async function createNewMember() {
    const result = await createPendingMember({ phone: memberQuery, fullName: newMemberName });
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    chooseMember(result.member);
    setNewMemberName('');
    setMessage({ type: 'success', text: 'Đã tạo hội viên chờ kích hoạt.' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (cart.length === 0) return setMessage({ type: 'error', text: 'Hãy thêm ít nhất một món vào đơn.' });
    if (target === 'member' && !member) return setMessage({ type: 'error', text: 'Hãy chọn hội viên trước khi tạo đơn.' });
    if (consentRequired && (!pointsConsentConfirmed || pointsConsentNote.trim().length < 10)) {
      return setMessage({ type: 'error', text: 'Hãy xác nhận đồng ý và nhập lý do dùng điểm từ 10 ký tự.' });
    }
    if (mode === 'pos' && target === 'member' && voucherCode.trim() && (!voucherConsentConfirmed || voucherConsentNote.trim().length < 10)) {
      return setMessage({ type: 'error', text: 'Hãy xác nhận hội viên đồng ý và nhập lý do sử dụng voucher từ 10 ký tự.' });
    }
    setSubmitting(true);
    const result = await (mode === 'pos' ? createCounterOrder : createAdminAssistedOrder)({
      idempotencyKey: crypto.randomUUID(),
      targetMemberId: target === 'member' ? member?.id ?? null : null,
      customerName,
      customerPhone,
      fulfillment,
      pickupAt: fulfillment === 'pickup' ? pickupAt : undefined,
      deliveryAddress: fulfillment === 'delivery' ? deliveryAddress : undefined,
      note,
      voucherCode,
      paymentMethod,
      pointsToApply: points,
      pointsConsentConfirmed,
      pointsConsentNote,
      voucherConsentConfirmed,
      voucherConsentNote,
      items: cart.map((line) => ({ productId: line.product.id, optionIds: line.optionIds, quantity: line.quantity, specialNote: line.specialNote })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setMessage({ type: 'error', text: `${result.error}${result.reference ? ` Mã hỗ trợ: ${result.reference}` : ''}` });
      return;
    }
    setMessage({ type: 'success', text: 'Đã tạo đơn. Đang mở chi tiết đơn hàng...' });
    router.push(mode === 'pos' ? `/pos/orders/${result.order.id}` : `/admin/orders/${result.order.id}`);
  }

  const optionGroups = ['size', 'sugar', 'ice', 'topping'].map((group) => ({
    group,
    options: selectedProduct?.options?.filter((option) => option.group === group) ?? [],
  })).filter((section) => section.options.length > 0);

  return (
    <form className={pageStyles.form} onSubmit={submit}>
      <section className={pageStyles.section} aria-labelledby="order-target-title">
        <div className={pageStyles.sectionHeader}><div><h2 id="order-target-title">Người nhận đơn</h2><p>{mode === 'pos' ? 'Tìm bằng số điện thoại, mã hội viên hoặc tạo hội viên tại quầy.' : 'Chọn hội viên để ghi lịch sử, thông báo và cho phép dùng quyền lợi.'}</p></div></div>
        <div className={pageStyles.segmented} role="group" aria-label="Loại khách hàng">
          <button type="button" className={target === 'member' ? pageStyles.segmentActive : ''} onClick={() => chooseTarget('member')}><Check size={16} /> Hội viên</button>
          <button type="button" className={target === 'guest' ? pageStyles.segmentActive : ''} onClick={() => chooseTarget('guest')}>Khách vãng lai</button>
        </div>
        {target === 'member' && (
          <div className={pageStyles.memberPicker}>
            {mode === 'pos' && <MemberPassResolver onResolved={chooseMember} />}
            <label htmlFor="admin-member-search">{mode === 'pos' ? 'Tìm theo mã hội viên hoặc số điện thoại' : 'Tìm theo mã, tên, email hoặc số điện thoại'}</label>
            <div className={pageStyles.inlineForm}>
              <input id="admin-member-search" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchMembers(); } }} maxLength={80} />
              <button type="button" className={pageStyles.secondaryButton} onClick={() => void searchMembers()} disabled={searching}><Search size={16} /> Tìm</button>
            </div>
            {memberResults.length > 0 && <div className={pageStyles.memberResults}>{memberResults.map((result) => <button type="button" key={result.id} onClick={() => chooseMember(result)}><strong>BB-{String(result.memberNumber).padStart(8, '0')}</strong><span>{result.fullName || 'Chưa cập nhật tên'} · {result.phone ?? result.pendingPhone ?? result.email ?? 'Không có liên hệ'}</span><b>{result.availablePoints.toLocaleString('vi-VN')} điểm</b></button>)}</div>}
            {mode === 'pos' && memberResults.length === 0 && memberQuery.trim().length >= 9 && !member && <div className={pageStyles.memberResults}><label>Tên hội viên mới <input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} maxLength={100} /></label><button type="button" className={pageStyles.secondaryButton} onClick={() => void createNewMember()}>Tạo hội viên chờ kích hoạt</button></div>}
            {member && <div className={pageStyles.selectedMember}><strong>BB-{String(member.memberNumber).padStart(8, '0')} · {member.fullName || 'Chưa cập nhật tên'}</strong><span>{member.availablePoints.toLocaleString('vi-VN')} điểm khả dụng</span></div>}
          </div>
        )}
      </section>

      <div className={pageStyles.columns}>
        <div className={pageStyles.mainColumn}>
          <section className={pageStyles.section} aria-labelledby="order-customer-title">
            <div className={pageStyles.sectionHeader}><div><h2 id="order-customer-title">Thông tin nhận hàng</h2><p>Có thể chỉnh riêng cho đơn này.</p></div></div>
            <div className={pageStyles.formGrid}>
              <label> Tên khách hàng <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={100} required /></label>
              <label>Số điện thoại <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} inputMode="tel" maxLength={20} required /></label>
              <label>Nhận hàng <select value={fulfillment} onChange={(event) => setFulfillment(event.target.value as 'pickup' | 'delivery')}><option value="pickup">Nhận tại quán</option><option value="delivery">Giao hàng</option></select></label>
              {fulfillment === 'pickup' ? <label>Thời gian nhận <input type="datetime-local" value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} required /></label> : <label className={pageStyles.fullWidth}>Địa chỉ giao hàng <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} maxLength={300} required /></label>}
              <label className={pageStyles.fullWidth}>Ghi chú <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} /></label>
            </div>
          </section>

          <section className={pageStyles.section} aria-labelledby="order-products-title">
            <div className={pageStyles.sectionHeader}><div><h2 id="order-products-title">Món trong đơn</h2><p>Chỉ chọn món đang bán trong menu hoạt động.</p></div></div>
            <div className={pageStyles.productPicker}>
              <label>Món <select value={productId} onChange={(event) => handleProductChange(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.nameVi} · {formatMoney(product.price)}</option>)}</select></label>
              {optionGroups.map((section) => <fieldset key={section.group}><legend>{section.group === 'size' ? 'Kích cỡ' : section.group === 'sugar' ? 'Lượng đường' : section.group === 'ice' ? 'Lượng đá' : 'Topping'}</legend><div className={pageStyles.optionGrid}>{section.options.map((option) => <button type="button" key={option.id} className={optionIds.includes(option.id) ? pageStyles.optionActive : ''} onClick={() => toggleOption(option)} aria-pressed={optionIds.includes(option.id)}>{optionLabel(option)}</button>)}</div></fieldset>)}
              <div className={pageStyles.addRow}><label>Số lượng <input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label><label>Ghi chú món <input value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} maxLength={200} /></label><button type="button" className={pageStyles.primaryButton} onClick={addLine}><Plus size={16} /> Thêm món</button></div>
            </div>
            {cart.length > 0 && <div className={pageStyles.cartList}>{cart.map((line) => <div key={line.id}><div><strong>{line.product.nameVi} × {line.quantity}</strong><span>{line.product.options?.filter((option) => line.optionIds.includes(option.id)).map(optionLabel).join(' · ') || 'Không tuỳ chọn'}{line.specialNote ? ` · ${line.specialNote}` : ''}</span></div><b>{formatMoney((line.product.price + (line.product.options?.filter((option) => line.optionIds.includes(option.id)).reduce((sum, option) => sum + option.extraPrice, 0) ?? 0)) * line.quantity)}</b><button type="button" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))} aria-label={`Xoá ${line.product.nameVi}`}><Trash2 size={16} /></button></div>)}</div>}
          </section>
        </div>

        <aside className={pageStyles.summary} aria-labelledby="order-summary-title">
          <h2 id="order-summary-title">Tóm tắt đơn</h2>
          <div className={pageStyles.summaryRow}><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>
          <label>Mã voucher <input value={voucherCode} onChange={(event) => { setVoucherCode(event.target.value.toUpperCase()); setVoucherMessage(''); setVoucherConsentConfirmed(false); setVoucherConsentNote(''); }} maxLength={32} /></label>
          {mode === 'pos' && member && <>
            <label className={pageStyles.checkLabel}>
              <input type="checkbox" checked={voucherConsentConfirmed} onChange={(event) => setVoucherConsentConfirmed(event.target.checked)} />
              Đã xác nhận hội viên đồng ý sử dụng voucher
            </label>
            <label>Lý do sử dụng voucher <textarea value={voucherConsentNote} onChange={(event) => setVoucherConsentNote(event.target.value)} minLength={10} maxLength={300} rows={2} /></label>
            <button type="button" className={pageStyles.secondaryButton} onClick={() => void claimVoucherAtCounter()} disabled={!voucherCode.trim() || !voucherConsentConfirmed || voucherConsentNote.trim().length < 10}>Lấy voucher cho hội viên</button>
            {voucherMessage && <p className={pageStyles.serverNote} role="status">{voucherMessage}</p>}
          </>}
          {target === 'member' && member && pointsEnabled && <div className={pageStyles.pointsBox}><div className={pageStyles.summaryRow}><span>Điểm khả dụng</span><strong>{member.availablePoints.toLocaleString('vi-VN')}</strong></div><label>Điểm sử dụng <input type="number" min="0" max={Math.min(member.availablePoints, subtotal)} value={pointsToApply} onChange={(event) => setPointsToApply(event.target.value)} /></label>{consentRequired && <><label className={pageStyles.checkLabel}><input type="checkbox" checked={pointsConsentConfirmed} onChange={(event) => setPointsConsentConfirmed(event.target.checked)} /> Đã xác nhận hội viên đồng ý dùng điểm</label><label>Lý do dùng điểm <textarea value={pointsConsentNote} onChange={(event) => setPointsConsentNote(event.target.value)} minLength={10} maxLength={300} rows={3} required /></label></>}</div>}
          <fieldset className={pageStyles.payment}><legend>Thanh toán</legend><label><input type="radio" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} /> COD</label>{sepayEnabled && <label><input type="radio" checked={paymentMethod === 'sepay_qr'} onChange={() => setPaymentMethod('sepay_qr')} /> QR chuyển khoản</label>}</fieldset>
          <p className={pageStyles.serverNote}>Giá cuối, voucher, điểm và tình trạng món sẽ được xác minh lại trên server.</p>
          {message && <p className={message.type === 'error' ? pageStyles.error : pageStyles.success} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <button type="submit" className={pageStyles.submitButton} disabled={submitting}>{submitting ? <LoaderCircle size={18} className={pageStyles.spinner} /> : <Check size={18} />} {submitting ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}</button>
        </aside>
      </div>
    </form>
  );
}
