import type { ReactNode } from 'react';
import AdminSectionNav from './AdminSectionNav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminSectionNav />
      {children}
    </>
  );
}
