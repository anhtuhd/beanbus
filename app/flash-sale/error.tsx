'use client';

import Link from 'next/link';

export default function Error({ reset }: { reset: () => void }) {
  return <div className="wrap noScriptContent"><h1>Không thể tải flash-sale</h1><p>Đã xảy ra lỗi tạm thời.</p><div className="errorActions"><button type="button" className="btn btn-primary" onClick={reset}>Thử lại</button><Link className="btn btn-secondary" href="/account">Về tài khoản</Link></div></div>;
}
