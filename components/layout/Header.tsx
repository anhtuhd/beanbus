'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { BRAND_ASSETS } from '@/lib/brand/assets';
import { 
  ShoppingBag, User, Menu, X, Phone, ChevronDown, Award, ShieldCheck
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
  menuId: string;
  item: NavItem;
  t: (vi: string, en: string) => string;
  pathname: string;
  setMobileOpen: (open: boolean) => void;
}

function routePath(href: string): string {
  return href.split('#', 1)[0] || '/';
}

function isNavHrefActive(href: string, pathname: string): boolean {
  return routePath(href) === pathname;
}

const navConfig: NavItem[] = [
  { href: '/', labelVi: 'Trang chủ', labelEn: 'Home' },
  {
    labelVi: 'Về Beanbus',
    labelEn: 'About Beanbus',
    children: [
      { href: '/about#top', labelVi: 'Tổng quan', labelEn: 'Overview' },
      { href: '/about#story', labelVi: 'Câu chuyện', labelEn: 'Story' },
      { href: '/about#process', labelVi: 'Quy trình', labelEn: 'Process' },
      { href: '/about#roastery', labelVi: 'Xưởng Rang', labelEn: 'Roastery' },
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

function focusFirstMenuItem(event: React.KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== 'ArrowDown') return;
  event.preventDefault();
  const wrapper = event.currentTarget.parentElement;
  wrapper?.setAttribute('data-keyboard-open', 'true');
  event.currentTarget.setAttribute('aria-expanded', 'true');
  const firstItem = wrapper?.querySelector<HTMLElement>('a[href]');
  window.requestAnimationFrame(() => firstItem?.focus());
}

function toggleKeyboardMenu(event: React.MouseEvent<HTMLButtonElement>) {
  const wrapper = event.currentTarget.parentElement;
  const open = wrapper?.getAttribute('data-keyboard-open') !== 'true';
  if (open) wrapper?.setAttribute('data-keyboard-open', 'true');
  else wrapper?.removeAttribute('data-keyboard-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
}

function closeMenuOnBlur(event: React.FocusEvent<HTMLDivElement>) {
  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
  event.currentTarget.removeAttribute('data-keyboard-open');
  event.currentTarget.querySelector('button')?.setAttribute('aria-expanded', 'false');
}

function closeMenuOnEscape(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Escape') return;
  const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button');
  event.currentTarget.removeAttribute('data-keyboard-open');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.focus();
}

const MobileNavItem = ({ item, menuId, t, pathname, setMobileOpen }: MobileNavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = Boolean(
    (item.href && isNavHrefActive(item.href, pathname))
      || item.children?.some((child) => isNavHrefActive(child.href, pathname))
  );

  if (item.children) {
    return (
      <div className={styles.mobileNavItem}>
        <button 
          className={`${styles.mobileNavParent} ${isActive ? styles.activeMobile : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={menuId}
        >
          {t(item.labelVi, item.labelEn)}
          <ChevronDown size={18} className={`${styles.mobileChevron} ${isOpen ? styles.open : ''}`} />
        </button>
        {isOpen && (
          <div id={menuId} className={styles.mobileNavChildren}>
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={`${styles.mobileNavLink} ${isNavHrefActive(child.href, pathname) ? styles.activeMobile : ''}`}
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
  const isAdmin = user?.role === 'admin';
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = mobileMenuPath === pathname;
  const setMobileOpen = (open: boolean) => setMobileMenuPath(open ? pathname : null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuPath(null);
      requestAnimationFrame(() => burgerRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const isItemActive = (item: NavItem) => {
    if (item.href && isNavHrefActive(item.href, pathname)) return true;
    if (item.children?.some(child => isNavHrefActive(child.href, pathname))) return true;
    return false;
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`wrap ${styles.navBar}`}>
        {/* LOGO */}
        <Link href="/" className={styles.logo}>
          <Image
            src={BRAND_ASSETS.logoDark}
            alt="Beanbus Coffee Roaster"
            width={180}
            height={34}
            priority
            className={styles.logoImage}
          />
        </Link>

        {/* DESKTOP NAV */}
        <nav className={styles.mainNav}>
          {navConfig.map((item, idx) => {
            const active = isItemActive(item);
            if (item.children) {
              return (
                <div key={idx} className={styles.navDropdownWrapper} onBlur={closeMenuOnBlur} onKeyDown={closeMenuOnEscape}>
                  <button type="button" className={`${styles.navLink} ${styles.navLinkButton} ${active ? styles.active : ''}`} aria-haspopup="true" aria-expanded="false" onClick={toggleKeyboardMenu} onKeyDown={focusFirstMenuItem}>
                    {t(item.labelVi, item.labelEn)}
                    <ChevronDown size={14} className={styles.chevron} />
                  </button>
                  <div className={styles.dropdownMenu}>
                    {item.children.map(child => (
                      <Link 
                        key={child.href} 
                        href={child.href} 
                        className={`${styles.dropdownItem} ${isNavHrefActive(child.href, pathname) ? styles.activeDropItem : ''}`}
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
          <div className={styles.accountDropdownWrapper} onBlur={closeMenuOnBlur} onKeyDown={closeMenuOnEscape}>
            <button className={styles.accountBtn} title={isAdmin ? t('Quản trị', 'Admin') : t('Hội viên', 'Member')} aria-haspopup="true" aria-expanded="false" onClick={toggleKeyboardMenu} onKeyDown={focusFirstMenuItem}>
              <User size={18} />
              <span className={styles.accountText}>
                {isAdmin ? t('Quản trị', 'Admin') : isLoggedIn ? user?.tier : t('Hội viên', 'Member')}
              </span>
              <ChevronDown size={14} className={styles.chevron} />
            </button>

            <div className={styles.accountDropdown}>
              {isLoggedIn && (
                <div className={styles.userInfo}>
                  <div className={styles.userTier}>
                    {isAdmin ? <ShieldCheck size={16} /> : <Award size={16} />}
                    <span>{isAdmin ? t('Quản trị', 'Admin') : user?.tier || 'Member'}</span>
                  </div>
                  {!isAdmin && user?.points !== undefined && (
                    <div className={styles.userPoints}>
                      {user.points} points
                    </div>
                  )}
                </div>
              )}
              <Link href={isAdmin ? '/admin' : isLoggedIn ? '/account' : '/login'} className={styles.accountDropItem}>
                <User size={16} />
                {isAdmin ? t('Mở Admin Panel', 'Open Admin Panel') : t('Tài khoản', 'Account')}
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
            ref={burgerRef}
            className={styles.burger}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? t('Đóng menu', 'Close menu') : t('Mở menu', 'Open menu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE NAV DRAWER */}
      {mobileOpen && (
        <div className={styles.mobileDrawer}>
          <nav id="mobile-navigation" className={styles.mobileNav} aria-label={t('Điều hướng di động', 'Mobile navigation')}>
            {navConfig.map((item, idx) => (
              <MobileNavItem 
                key={idx} 
                item={item} 
                menuId={`mobile-submenu-${idx}`}
                t={t} 
                pathname={pathname} 
                setMobileOpen={setMobileOpen} 
              />
            ))}
            <div className={styles.mobileExtraLinks}>
              <Link href={isAdmin ? '/admin' : isLoggedIn ? '/account' : '/login'} className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>
                <User size={17} /> {isAdmin ? t('Admin Panel', 'Admin Panel') : t('Tài khoản hội viên', 'Member Account')} {!isAdmin && isLoggedIn ? `(${user?.tier || 'Member'})` : ''}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
