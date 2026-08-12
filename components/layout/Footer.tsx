'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { MapPin, Phone, Clock, Mail } from 'lucide-react';
import { BRAND_ASSETS } from '@/lib/brand/assets';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const { settings } = useStoreSettings();
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.container}`}>
        {/* TOP SECTION */}
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <Image
              src={BRAND_ASSETS.logoLight}
              alt="Beanbus Coffee Roaster"
              width={190}
              height={36}
              className={styles.logoImage}
            />
            <p className={styles.tagline}>Brew Better Every Day</p>
            <p className={styles.desc}>
              {t(
                'Quán cà phê & xưởng rang đặc sản hàng đầu tại Hải Phòng. Đồ uống tinh tế, bánh tươi mỗi ngày và hạt cà phê rang sỉ & lẻ.',
                'Specialty café & coffee roastery in Hải Phòng. Artisanal drinks, fresh daily pastry & roasted beans wholesale/retail.'
              )}
            </p>
            <div className={styles.socials}>
              <a href={settings.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12.06C22 6.5 17.5 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.9h2.54V9.84c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94Z"/></svg>
              </a>
              <a href={settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>
              </a>
            </div>
          </div>

          <div className={styles.linksCol}>
            <h4>{t('Khám Phá', 'Explore')}</h4>
            <Link href="/">{t('Trang chủ', 'Home')}</Link>
            <Link href="/menu">{t('Menu Quán', 'Café Menu')}</Link>
            <Link href="/#beans">{t('Hạt Cà Phê B2B', 'Coffee Beans B2B')}</Link>
            <Link href="/booking">{t('Đặt Bàn Trước', 'Book Table')}</Link>
            <Link href="/events">{t('Sự Kiện & Workshop', 'Events & Workshop')}</Link>
            <Link href="/blog">{t('Blog Cà Phê', 'Coffee Blog')}</Link>
          </div>

          <div className={styles.linksCol}>
            <h4>{t('Hội Viên & Dịch Vụ', 'Services & Account')}</h4>
            <Link href="/account">{t('Trang Hội Viên', 'Member Profile')}</Link>
            <Link href="/account#loyalty">{t('Tích Điểm Ưu Đãi', 'Loyalty Rewards')}</Link>
            <Link href="/order">{t('Đặt Đồ Mang Đi', 'Order Takeaway')}</Link>
          </div>

          <div className={styles.contactCol}>
            <h4>{t('Ghé Quán', 'Visit Us')}</h4>
            <div className={styles.contactItem}>
              <MapPin size={18} className={styles.icon} />
              <span>{settings.address}</span>
            </div>
            <div className={styles.contactItem}>
              <Phone size={18} className={styles.icon} />
              <a href={`tel:${settings.phone.replace(/\s+/g, '')}`}>{settings.phone}</a>
            </div>
            <div className={styles.contactItem}>
              <Clock size={18} className={styles.icon} />
              <span>{settings.openingHours} ({t('Tất cả các ngày', 'Every day')})</span>
            </div>
            <div className={styles.contactItem}>
              <Mail size={18} className={styles.icon} />
              <span>{settings.email}</span>
            </div>
          </div>
        </div>

        {/* BOTTOM COPYRIGHT */}
        <div className={styles.bottom}>
          <p>© {currentYear} Beanbus Coffee Roaster (beanbus.vn). {t('Đã đăng ký bản quyền.', 'All rights reserved.')}</p>
          <p>{t('Thiết kế & phát triển bởi đội ngũ Beanbus', 'Designed & developed by Beanbus team')}</p>
        </div>
      </div>
    </footer>
  );
};
