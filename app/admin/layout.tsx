import type { ReactNode } from 'react';
import AdminSectionNav from './AdminSectionNav';
import { getAppMode } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (getAppMode() !== 'demo') await requireAdmin();

  return (
    <>
      <AdminSectionNav />
      {children}
    </>
  );
}
