'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import styles from '../../requests/requests.module.css';

export default function CopyGuestReceiptLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.primaryLink} onClick={() => void copy()}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Đã sao chép link biên nhận' : 'Sao chép link biên nhận'}
    </button>
  );
}
