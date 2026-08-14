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
  KeyRound,
  Settings2,
  Bell,
} from 'lucide-react';
import { getAppMode, isNotificationsEnabled } from '@/lib/env';
import styles from './admin.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';

const sections = [
  { href: '/admin', vi: 'Tổng quan', en: 'Overview', icon: LayoutDashboard },
  { href: '/admin/orders', vi: 'Đơn hàng', en: 'Orders', icon: ShoppingBag },
  { href: '/admin/requests', vi: 'Yêu cầu', en: 'Requests', icon: Inbox },
  { href: '/admin/catalog', vi: 'Catalog', en: 'Catalog', icon: Coffee },
  { href: '/admin/content', vi: 'Nội dung', en: 'Content', icon: FileText },
  { href: '/admin/members', vi: 'Hội viên', en: 'Members', icon: Users },
  { href: '/admin/loyalty', vi: 'Loyalty', en: 'Loyalty', icon: Coins },
  { href: '/admin/vouchers', vi: 'Voucher', en: 'Vouchers', icon: Ticket },
  { href: '/admin/rewards', vi: 'Rewards', en: 'Rewards', icon: Gift },
  { href: '/admin/policies', vi: 'Chính sách', en: 'Policies', icon: Settings2 },
  { href: '/admin/notifications', vi: 'Thông báo', en: 'Notifications', icon: Bell },
  { href: '/admin/security', vi: 'Bảo mật', en: 'Security', icon: KeyRound },
  { href: '/admin/stored-value', vi: 'Gói nạp điểm', en: 'Stored value', icon: WalletCards },
] as const;

export default function AdminSectionNav() {
  if (getAppMode() === 'demo') return null;

  const sectionsWithFlags = isNotificationsEnabled()
    ? sections
    : sections.filter((section) => section.href !== '/admin/notifications');

  return (
    <div className={styles.adminNavSticky}>
      <div className={`wrap ${styles.adminNavWrap}`}>
        <nav className={styles.adminNav} aria-label="Admin navigation">
          {sectionsWithFlags.map(({ href, vi, en, icon: Icon }) => (
            <Link key={href} href={href} className={styles.adminNavLink}>
              <Icon size={15} aria-hidden="true" />
              <span><LocalizedText vi={vi} en={en} /></span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
