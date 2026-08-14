'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, LoaderCircle, Move, RotateCcw, UploadCloud } from 'lucide-react';
import { cropToWebp, inspectSourceImage, type CropSelection } from '@/lib/media/crop';
import type { MediaKind } from '@/lib/media/r2-validation';
import styles from './MediaUploader.module.css';

type UploadedMedia = { publicUrl: string; stagingKey: string; finalKey: string; contentLength: number };
type Props = { kind: MediaKind; name: string; defaultValue?: string; required?: boolean; onUploaded?: (media: UploadedMedia) => void };
type SourceImage = { file: File; url: string; width: number; height: number };

function message(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'SOURCE_IMAGE_TOO_SMALL') return 'Ảnh chưa đủ độ phân giải cho khung này.';
  if (code === 'OUTPUT_IMAGE_TOO_LARGE') return 'Ảnh sau khi crop vẫn lớn hơn 2 MB.';
  return 'Không thể xử lý ảnh. Hãy thử lại bằng JPG, PNG hoặc WebP.';
}

export default function MediaUploader({ kind, name, defaultValue = '', required = false, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [selection, setSelection] = useState<CropSelection>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    try {
      const dimensions = await inspectSourceImage(file, kind);
      if (source) URL.revokeObjectURL(source.url);
      setSource({ file, url: URL.createObjectURL(file), ...dimensions });
      setSelection({ offsetX: 0, offsetY: 0, zoom: 1 });
      setStatus('');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function upload() {
    if (!source) return;
    setBusy(true);
    setProgress(0);
    try {
      const blob = await cropToWebp(source.file, kind, selection);
      const response = await fetch('/api/admin/media/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, contentType: 'image/webp', size: blob.size, width: kind === 'product' ? 1600 : 1600, height: kind === 'product' ? 1200 : 900 }),
      });
      const payload = await response.json() as { uploadUrl?: string; publicUrl?: string; stagingKey?: string; finalKey?: string; error?: { message?: string } };
      if (!response.ok || !payload.uploadUrl || !payload.publicUrl || !payload.stagingKey || !payload.finalKey) throw new Error(payload.error?.message || 'UPLOAD_SESSION_FAILED');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', payload.uploadUrl!);
        xhr.setRequestHeader('Content-Type', 'image/webp');
        xhr.setRequestHeader('Cache-Control', 'private, max-age=300');
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('R2_UPLOAD_FAILED'));
        xhr.onerror = () => reject(new Error('R2_UPLOAD_FAILED'));
        xhr.send(blob);
      });
      setValue(payload.publicUrl);
      const staging = document.querySelector<HTMLInputElement>(`input[name="${name}StagingKey"]`);
      const finalKey = document.querySelector<HTMLInputElement>(`input[name="${name}FinalKey"]`);
      const length = document.querySelector<HTMLInputElement>(`input[name="${name}ContentLength"]`);
      if (staging) staging.value = payload.stagingKey;
      if (finalKey) finalKey.value = payload.finalKey;
      if (length) length.value = String(blob.size);
      onUploaded?.({ publicUrl: payload.publicUrl, stagingKey: payload.stagingKey, finalKey: payload.finalKey, contentLength: blob.size });
      setStatus('Đã tải ảnh lên, hãy bấm lưu để hoàn tất.');
      setSource(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Không thể tải ảnh lên.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSource(null);
    setSelection({ offsetX: 0, offsetY: 0, zoom: 1 });
    setStatus('');
    setProgress(0);
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Ảnh {kind === 'product' ? 'sản phẩm' : kind === 'event' ? 'sự kiện' : 'bài viết'}</span>
      <input type="hidden" name={name} value={value} required={required} readOnly />
      <input type="hidden" name={`${name}StagingKey`} />
      <input type="hidden" name={`${name}FinalKey`} />
      <input type="hidden" name={`${name}ContentLength`} />
      <div className={styles.previewRow}>
        {value ? <Image src={value} alt="" width={120} height={90} unoptimized className={styles.preview} /> : <div className={styles.empty}><ImagePlus size={22} /> Chưa có ảnh</div>}
        <div className={styles.controls}>
          <button type="button" className={styles.secondary} onClick={() => fileRef.current?.click()} disabled={busy}><UploadCloud size={16} /> Chọn ảnh</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={(event) => selectFile(event.target.files?.[0])} />
          <small>Crop {kind === 'product' ? '4:3' : '16:9'} · WebP · tối đa 2 MB</small>
        </div>
      </div>
      {source && (
        <div className={styles.cropPanel}>
          <div
            className={`${styles.cropFrame} ${kind === 'product' ? '' : styles.cropFrameWide}`}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragStart({ x: event.clientX, y: event.clientY, offsetX: selection.offsetX, offsetY: selection.offsetY }); }}
            onPointerMove={(event) => {
              if (!dragStart) return;
              setSelection((current) => ({ ...current, offsetX: Math.max(-1, Math.min(1, dragStart.offsetX + (event.clientX - dragStart.x) / 150)), offsetY: Math.max(-1, Math.min(1, dragStart.offsetY + (event.clientY - dragStart.y) / 150)) }));
            }}
            onPointerUp={() => setDragStart(null)}
            onPointerCancel={() => setDragStart(null)}
          >
            <Image src={source.url} alt="Xem vùng crop" fill unoptimized sizes="360px" className={styles.cropImage} style={{ transform: `translate(${selection.offsetX * 24}px, ${selection.offsetY * 24}px) scale(${selection.zoom})` }} />
            <span className={styles.cropHint}><Move size={14} /> Kéo để căn ảnh</span>
          </div>
          <label className={styles.zoom}>Phóng to <input type="range" min="1" max="2" step="0.01" value={selection.zoom} onChange={(event) => setSelection((current) => ({ ...current, zoom: Number(event.target.value) }))} /></label>
          <div className={styles.cropActions}>
            <button type="button" className={styles.secondary} onClick={reset}><RotateCcw size={15} /> Chọn lại</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={upload} disabled={busy}>{busy ? <LoaderCircle size={15} className={styles.spin} /> : <UploadCloud size={15} />} {busy ? `Đang tải ${progress}%` : 'Crop & tải lên'}</button>
          </div>
        </div>
      )}
      {status && <small className={styles.status} role="status">{status}</small>}
    </div>
  );
}
