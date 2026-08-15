'use client';

import { useRef, useState } from 'react';
import { Camera, LoaderCircle, Search, X } from 'lucide-react';
import type { AdminOrderMember } from '@/app/admin/orders/new/actions';
import styles from '@/app/admin/orders/new/admin-order-new.module.css';

type BarcodeDetectorLike = { detect(video: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function MemberPassResolver({ onResolved }: { onResolved: (member: AdminOrderMember) => void }) {
  const [token, setToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function resolve(value = token) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/pos/member-pass/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: value }) });
      const payload = await response.json() as { member?: Record<string, unknown>; error?: { message?: string } };
      if (!response.ok || !payload.member) throw new Error(payload.error?.message ?? 'Mã hội viên không hợp lệ.');
      const member = payload.member;
      onResolved({
        id: String(member.id), memberNumber: Number(member.member_number), fullName: typeof member.full_name === 'string' ? member.full_name : null,
        email: null, phone: typeof member.phone === 'string' ? member.phone : null,
        pendingPhone: typeof member.pending_phone === 'string' ? member.pending_phone : null, membershipStatus: typeof member.membership_status === 'string' ? member.membership_status : undefined,
        availablePoints: Math.max(0, Number(member.available_points ?? 0)),
      });
      setToken('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể đọc mã hội viên.');
    } finally {
      setBusy(false);
    }
  }

  async function stopScanner() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function scan() {
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setMessage('Thiết bị chưa hỗ trợ quét QR. Hãy dán mã hoặc nhập thủ công.');
      return;
    }
    setMessage('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new Detector({ formats: ['qr_code'] });
      const started = Date.now();
      while (Date.now() - started < 30_000 && streamRef.current) {
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue;
        if (value) { await stopScanner(); setToken(value); await resolve(value); return; }
        await new Promise((wait) => window.setTimeout(wait, 250));
      }
      setMessage('Không tìm thấy mã QR trong thời gian cho phép.');
    } catch {
      setMessage('Không thể mở camera. Hãy dùng ô nhập mã hội viên.');
    } finally {
      await stopScanner();
    }
  }

  return (
    <div className={styles.memberPassResolver}>
      <div className={styles.inlineForm}>
        <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Dán mã QR hội viên" maxLength={512} aria-label="Mã QR hội viên" />
        <button type="button" className={styles.secondaryButton} onClick={() => void resolve()} disabled={busy || !token}><Search size={16} /> Tìm</button>
        <button type="button" className={styles.secondaryButton} onClick={() => void scan()} disabled={busy || scanning}><Camera size={16} /> Quét</button>
      </div>
      {scanning && <div className={styles.scannerPanel}><video ref={videoRef} muted playsInline /><button type="button" className={styles.secondaryButton} onClick={() => void stopScanner()}><X size={16} /> Dừng</button></div>}
      {busy && <LoaderCircle className={styles.spinner} aria-label="Đang xác minh" />}
      {message && <p className={styles.error} role="alert">{message}</p>}
    </div>
  );
}
