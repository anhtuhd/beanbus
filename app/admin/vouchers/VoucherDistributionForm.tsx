'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Search, Send } from 'lucide-react';
import { distributeAdminVoucher, searchVoucherMembers, type VoucherMember } from './actions';
import styles from '../requests/requests.module.css';

export default function VoucherDistributionForm({ code }: { code: string }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<VoucherMember[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    setBusy(true);
    setMessage('');
    setMembers(await searchVoucherMembers(query));
    setBusy(false);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function distribute() {
    setBusy(true);
    setMessage('');
    const result = await distributeAdminVoucher(code, selected);
    setMessage(result.ok ? `Đã phát voucher cho ${result.count} hội viên.` : result.error);
    if (result.ok) setSelected([]);
    setBusy(false);
  }

  return (
    <section className={styles.editorDetails} aria-labelledby="voucher-distribution-title">
      <div className={styles.editorHeading}>
        <h3 id="voucher-distribution-title"><Send size={17} /> Phát voucher cho hội viên</h3>
        <span>{selected.length} đã chọn</span>
      </div>
      <div className={styles.searchForm}>
        <label htmlFor="voucher-member-search">Tìm theo mã, tên, email hoặc số điện thoại</label>
        <div>
          <input id="voucher-member-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={80} />
          <button type="button" onClick={() => void search()} disabled={busy || query.trim().length < 2}><Search size={16} /> Tìm</button>
        </div>
      </div>
      {members.length > 0 && <div className={styles.requestList}>{members.map((member) => <label key={member.id} className={styles.requestRow}>
        <input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} />
        <span><strong>BB-{String(member.memberNumber).padStart(8, '0')}</strong><small>{member.fullName || 'Chưa cập nhật tên'} · {member.email || member.phone || 'Không có liên hệ'}</small></span>
      </label>)}</div>}
      <button type="button" className={styles.primaryLink} onClick={() => void distribute()} disabled={busy || selected.length === 0}>{busy ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />} Phát {code}</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
