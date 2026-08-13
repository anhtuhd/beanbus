'use client';

import Link from 'next/link';
import { LocalizedText } from '@/components/ui/LocalizedText';

export default function Error({ reset }: { reset: () => void }) {
  return <div className="wrap noScriptContent"><h1><LocalizedText vi="Không thể tải flash-sale" en="Unable to load flash sale" /></h1><p><LocalizedText vi="Đã xảy ra lỗi tạm thời." en="A temporary error occurred." /></p><div className="errorActions"><button type="button" className="btn btn-primary" onClick={reset}><LocalizedText vi="Thử lại" en="Try again" /></button><Link className="btn btn-secondary" href="/account"><LocalizedText vi="Về tài khoản" en="Back to account" /></Link></div></div>;
}
