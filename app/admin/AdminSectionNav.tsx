import Link from 'next/link';
import {
  Coffee,
  FileText,
  Gift,
  Inbox,
  LayoutDashboard,
  Ticket,
  Users,
  WalletCards,
  ShoppingBag,
  Coins,
} from 'lucide-react';
import { getAppMode } from '@/lib/env';
import { isStoredValueConfigured } from '@/lib/stored-value/config';
import styles from './admin.module.css';

const sections = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Đơn hàng', icon: ShoppingBag },
  { href: '/admin/requests', label: 'Yêu cầu', icon: Inbox },
  { href: '/admin/catalog', label: 'Catalog', icon: Coffee },
  { href: '/admin/content', label: 'Nội dung', icon: FileText },
  { href: '/admin/members', label: 'Hội viên', icon: Users },
  { href: '/admin/loyalty', label: 'Loyalty', icon: Coins },
  { href: '/admin/vouchers', label: 'Voucher', icon: Ticket },
  { href: '/admin/rewards', label: 'Rewards', icon: Gift },
  { href: '/admin/stored-value', label: 'Stored-value', icon: WalletCards },
] as const;

export default function AdminSectionNav() {
  if (getAppMode() === 'demo') return null;

  const visibleSections = isStoredValueConfigured()
    ? sections
    : sections.filter((section) => section.href !== '/admin/stored-value');

  return (
    <div className={`wrap ${styles.adminNavWrap}`}>
      <nav className={styles.adminNav} aria-label="Điều hướng khu vực quản trị">
        {visibleSections.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={styles.adminNavLink}>
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
