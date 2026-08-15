'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { BRAND_ASSETS } from '@/lib/brand/assets';
import { isNavHrefActive } from './navigation';
import { NotificationBell } from './NotificationBell';
import {
  ShoppingBag, User, Menu, X, Phone, ChevronDown, Award, LogOut, Coins
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
  hash: string;
  setMobileOpen: (open: boolean) => void;
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

const MobileNavItem = ({ item, menuId, t, pathname, hash, setMobileOpen }: MobileNavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = Boolean(
    (item.href && isNavHrefActive(item.href, pathname, hash))
      || item.children?.some((child) => isNavHrefActive(child.href, pathname, hash))
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
                className={`${styles.mobileNavLink} ${isNavHrefActive(child.href, pathname, hash) ? styles.activeMobile : ''}`}
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
  const { user, isLoggedIn, isAuthReady, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const storedValueEnabled = process.env.NEXT_PUBLIC_ENABLE_STORED_VALUE === 'true'
    && process.env.NEXT_PUBLIC_ENABLE_SEPAY === 'true';
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [hash, setHash] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);
  const [pointsUserId, setPointsUserId] = useState<string | null>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = mobileMenuPath === pathname;
  const setMobileOpen = (open: boolean) => setMobileMenuPath(open ? pathname : null);

  useEffect(() => {
    let active = true;

    if (!isAuthReady || !isLoggedIn || user?.role !== 'member') {
      return () => {
        active = false;
      };
    }

    if (process.env.NEXT_PUBLIC_APP_MODE !== 'production') {
      return () => {
        active = false;
      };
    }

    const loadPoints = async () => {
      try {
        const response = await fetch('/api/account/points', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load points');
        const data = await response.json() as { availablePoints?: unknown };
        const points = Number(data.availablePoints);
        if (active) {
          setAvailablePoints(Number.isFinite(points) && points >= 0 ? points : null);
          setPointsUserId(user.id);
        }
      } catch {
        if (active) {
          setAvailablePoints(null);
          setPointsUserId(user.id);
        }
      }
    };

    void loadPoints();
    return () => {
      active = false;
    };
  }, [isAuthReady, isLoggedIn, user?.id, user?.role, user?.points]);

  const displayedPoints = user?.role === 'member' && isLoggedIn && isAuthReady
    ? process.env.NEXT_PUBLIC_APP_MODE === 'production'
      ? pointsUserId === user.id ? availablePoints : null
      : user.points
    : null;

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

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
    if (item.href && isNavHrefActive(item.href, pathname, hash)) return true;
    if (item.children?.some(child => isNavHrefActive(child.href, pathname, hash))) return true;
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
                        className={`${styles.dropdownItem} ${isNavHrefActive(child.href, pathname, hash) ? styles.activeDropItem : ''}`}
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
              title={t('Tiếng Việt', 'Vietnamese')}
            >
              VI
            </button>
            <button
              className={lang === 'en' ? styles.activeLang : ''}
              onClick={() => setLang('en')}
              title={t('Tiếng Anh', 'English')}
            >
              EN
            </button>
          </div>

          {/* ACCOUNT DROPDOWN */}
          {!isLoggedIn ? (
            <Link href="/login" className={styles.accountBtn} title={t('Hội viên', 'Member')}>
              <User size={18} />
              <span className={styles.accountText}>{t('Hội viên', 'Member')}</span>
            </Link>
          ) : (
            <div className={styles.accountDropdownWrapper} onBlur={closeMenuOnBlur} onKeyDown={closeMenuOnEscape}>
              <button className={styles.accountBtn} title={isAdmin ? t('Quản trị', 'Admin') : t('Hội viên', 'Member')} aria-haspopup="true" aria-expanded="false" onClick={toggleKeyboardMenu} onKeyDown={focusFirstMenuItem}>
                <User size={18} />
                <span className={styles.accountText}>
                  {isAdmin ? t('Quản trị', 'Admin') : user?.tier}
                </span>
                <ChevronDown size={14} className={styles.chevron} />
              </button>

              <div className={styles.accountDropdown}>
                {!isAdmin && (
                  <div className={styles.userInfo}>
                    <div className={styles.userTier}>
                      <Award size={16} />
                      <span>{user?.tier || 'Member'}</span>
                    </div>
                    {displayedPoints !== null && (
                      <div className={styles.userPoints}>
                        {displayedPoints.toLocaleString('vi-VN')} {t('điểm', 'points')}
                      </div>
                    )}
                  </div>
                )}
                <Link href={isAdmin ? '/admin' : '/account'} className={styles.accountDropItem}>
                  <User size={16} />
                  {isAdmin ? t('Mở Admin Panel', 'Open Admin Panel') : t('Tài khoản', 'Account')}
                </Link>
                {!isAdmin && storedValueEnabled && (
                  <Link href="/account/topup" className={styles.accountDropItem}>
                    <Coins size={16} />
                    {t('Nạp điểm', 'Top up points')}
                  </Link>
                )}
                <button type="button" className={`${styles.accountDropItem} ${styles.accountDropButton}`} onClick={logout}>
                  <LogOut size={16} />
                  {t('Đăng xuất', 'Log out')}
                </button>
              </div>
            </div>
          )}

          {/* QUICK ORDER / CALL */}
          <Link href="/order" className={`btn btn-primary btn-sm ${styles.quickOrder}`}>
            <Phone size={14} />
            <span>{t('Đặt đồ', 'Order Now')}</span>
          </Link>

          {/* UTILITY ACTIONS: keep cart and notifications at the far right */}
          <button
            className={styles.cartBtn}
            onClick={() => setIsCartOpen(true)}
            aria-label={t('Giỏ hàng', 'Cart')}
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
          </button>

          {process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true' && (
            <div className={styles.notificationSlot}>
              <NotificationBell
                isAdmin={isAdmin}
                isAuthReady={isAuthReady}
                isLoggedIn={isLoggedIn}
                userId={user?.id ?? null}
              />
            </div>
          )}

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
                hash={hash}
                setMobileOpen={setMobileOpen} 
              />
            ))}
            <div className={styles.mobileExtraLinks}>
              <Link href={isAdmin ? '/admin' : isLoggedIn ? '/account' : '/login'} className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>
                <User size={17} /> {isAdmin ? t('Admin Panel', 'Admin Panel') : t('Tài khoản hội viên', 'Member Account')} {!isAdmin && isLoggedIn ? `(${user?.tier || 'Member'})` : ''}
              </Link>
              {isLoggedIn && !isAdmin && storedValueEnabled && (
                <Link href="/account/topup" className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>
                  <Coins size={17} /> {t('Nạp điểm', 'Top up points')}
                </Link>
              )}
              {isLoggedIn && (
                <button type="button" className={`${styles.mobileNavLink} ${styles.mobileLogout}`} onClick={() => { setMobileOpen(false); logout(); }}>
                  <LogOut size={17} /> {t('Đăng xuất', 'Log out')}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
