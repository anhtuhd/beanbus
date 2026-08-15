import { requireOperator } from '@/lib/auth/session';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  await requireOperator();
  return children;
}
