'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
  ShoppingBag, User, Menu, X, Coffee, Phone, ChevronDown, Award
} from 'lucide-react';
import styles from './Header.module.css';

interface NavItem {
  href?: string;
  labelVi: string;
  labelEn: string;
  children?: {
    href: string;
    labelVi: string;
    labelEn: string;
  }[];
}

interface MobileNavItemProps {
  item: NavItem;
  t: (vi: string, en: string) => string;
  pathname: string;
  setMobileOpen: (open: boolean) => void;
}

const navConfig: NavItem[] = [
  { href: '/', labelVi: 'Trang chủ', labelEn: 'Home' },
  {
    labelVi: 'Về Beanbus',
    labelEn: 'About Beanbus',
    children: [
      { href: '/#story', labelVi: 'Câu chuyện', labelEn: 'Story' },
      { href: '/#roastery', labelVi: 'Xưởng Rang', labelEn: 'Roastery' },
      { href: '/#beans', labelVi: 'Hạt Cà Phê', labelEn: 'Coffee Beans' },
      { href: '/about', labelVi: 'Về chúng tôi', labelEn: 'About' },
    ]
  },
  {
    labelVi: 'Menu & Đặt đồ',
    labelEn: 'Menu & Order',
    children: [
      { href: '/menu', labelVi: 'Menu Quán', labelEn: 'Café Menu' },
      { href: '/booking', labelVi: 'Đặt bàn', labelEn: 'Book Table' },
    ]
  },
  {
    labelVi: 'Tin tức',
    labelEn: 'News',
    children: [
      { href: '/events', labelVi: 'Sự kiện', labelEn: 'Events' },
      { href: '/blog', labelVi: 'Blog', labelEn: 'Blog' },
    ]
  },
  { href: '/contact', labelVi: 'Liên hệ', labelEn: 'Contact' },
];

const MobileNavItem = ({ item, t, pathname, setMobileOpen }: MobileNavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = item.href === pathname || item.children?.some((child) => child.href === pathname);

  if (item.children) {
    return (
      <div className={styles.mobileNavItem}>
        <button 
          className={`${styles.mobileNavParent} ${isActive ? styles.activeMobile : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {t(item.labelVi, item.labelEn)}
          <ChevronDown size={18} className={`${styles.mobileChevron} ${isOpen ? styles.open : ''}`} />
        </button>
        {isOpen && (
          <div className={styles.mobileNavChildren}>
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={`${styles.mobileNavLink} ${pathname === child.href ? styles.activeMobile : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {t(child.labelVi, child.labelEn)}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`${styles.mobileNavLink} ${styles.mobileNavParent} ${isActive ? styles.activeMobile : ''}`}
      onClick={() => setMobileOpen(false)}
    >
      {t(item.labelVi, item.labelEn)}
    </Link>
  );
};

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();
  const { cartCount, setIsCartOpen } = useCart();
  const { user, isLoggedIn } = useAuth();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const mobileOpen = mobileMenuPath === pathname;
  const setMobileOpen = (open: boolean) => setMobileMenuPath(open ? pathname : null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isItemActive = (item: NavItem) => {
    if (item.href === pathname) return true;
    if (item.children?.some(child => child.href === pathname)) return true;
    return false;
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`wrap ${styles.navBar}`}>
        {/* LOGO */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoBox}>
            <Coffee className={styles.logoIcon} />
            <div className={styles.logoText}>
              <span className={styles.brandName}>BEANBUS</span>
              <span className={styles.brandSub}>COFFEE ROASTER</span>
            </div>
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className={styles.mainNav}>
          {navConfig.map((item, idx) => {
            const active = isItemActive(item);
            if (item.children) {
              return (
                <div key={idx} className={styles.navDropdownWrapper}>
                  <div className={`${styles.navLink} ${active ? styles.active : ''}`}>
                    {t(item.labelVi, item.labelEn)}
                    <ChevronDown size={14} className={styles.chevron} />
                  </div>
                  <div className={styles.dropdownMenu}>
                    {item.children.map(child => (
                      <Link 
                        key={child.href} 
                        href={child.href} 
                        className={`${styles.dropdownItem} ${pathname === child.href ? styles.activeDropItem : ''}`}
                      >
                        {t(child.labelVi, child.labelEn)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={idx}
                href={item.href!}
                className={`${styles.navLink} ${active ? styles.active : ''}`}
              >
                {t(item.labelVi, item.labelEn)}
              </Link>
            );
          })}
        </nav>

        {/* HEADER ACTIONS */}
        <div className={styles.actions}>
          {/* LANG SWITCH */}
          <div className={styles.langSwitch}>
            <button
              className={lang === 'vi' ? styles.activeLang : ''}
              onClick={() => setLang('vi')}
              title="Tiếng Việt"
            >
              VI
            </button>
            <button
              className={lang === 'en' ? styles.activeLang : ''}
              onClick={() => setLang('en')}
              title="English"
            >
              EN
            </button>
          </div>

          {/* CART BUTTON */}
          <button
            className={styles.cartBtn}
            onClick={() => setIsCartOpen(true)}
            aria-label="Giỏ hàng"
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
          </button>

          {/* ACCOUNT DROPDOWN */}
          <div className={styles.accountDropdownWrapper}>
            <button className={styles.accountBtn} title={t('Hội viên', 'Member')}>
              <User size={18} />
              <span className={styles.accountText}>
                {isLoggedIn ? user?.tier : t('Hội viên', 'Member')}
              </span>
              <ChevronDown size={14} className={styles.chevron} />
            </button>

            <div className={styles.accountDropdown}>
              {isLoggedIn && (
                <div className={styles.userInfo}>
                  <div className={styles.userTier}>
                    <Award size={16} />
                    <span>{user?.tier || 'Member'}</span>
                  </div>
                  {user?.points !== undefined && (
                    <div className={styles.userPoints}>
                      {user.points} points
                    </div>
                  )}
                </div>
              )}
              <Link href={isLoggedIn ? '/account' : '/login'} className={styles.accountDropItem}>
                <User size={16} />
                {t('Tài khoản', 'Account')}
              </Link>
            </div>
          </div>

          {/* QUICK ORDER / CALL */}
          <Link href="/order" className={`btn btn-primary btn-sm ${styles.quickOrder}`}>
            <Phone size={14} />
            <span>{t('Đặt đồ', 'Order Now')}</span>
          </Link>

          {/* MOBILE BURGER */}
          <button
            className={styles.burger}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE NAV DRAWER */}
      {mobileOpen && (
        <div className={styles.mobileDrawer}>
          <nav className={styles.mobileNav}>
            {navConfig.map((item, idx) => (
              <MobileNavItem 
                key={idx} 
                item={item} 
                t={t} 
                pathname={pathname} 
                setMobileOpen={setMobileOpen} 
              />
            ))}
            <div className={styles.mobileExtraLinks}>
              <Link href={isLoggedIn ? '/account' : '/login'} className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>
                👤 {t('Tài khoản hội viên', 'Member Account')} {isLoggedIn ? `(${user?.tier || 'Member'})` : ''}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
