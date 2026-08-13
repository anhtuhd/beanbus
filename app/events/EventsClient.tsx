'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import type { EventItem } from '@/data/events';
import { ArrowRight, Calendar, Clock, MapPin, Star, Users } from 'lucide-react';
import RsvpButton from './RsvpButton';
import styles from './events.module.css';
import { isNextOptimizedImage } from '@/lib/media/image';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';

export default function EventsClient({ events, page = 1, totalPages = 1 }: { events: EventItem[]; page?: number; totalPages?: number }) {
  const { t, lang } = useLanguage();

  return (
    <div className={styles.eventsPage}>
      {/* BANNER */}
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Cộng đồng Beanbus', 'Beanbus Community')}</span>
          </div>
          <h1 className={styles.title}>{t('Sự Kiện & Workshop Cà Phê', 'Coffee Events & Workshops')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Nơi kết nối đam mê cà phê đặc sản tại Hải Phòng — Cupping workshop, đêm nhạc acoustic và giải đấu Barista.',
              'Connecting specialty coffee lovers in Hải Phòng through workshops, acoustic nights, and barista contests.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        {events.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <Calendar size={32} aria-hidden="true" />
            <h2>{t('Hiện chưa có sự kiện sắp tới', 'No upcoming events')}</h2>
            <p>{t('Beanbus sẽ cập nhật workshop và hoạt động cộng đồng tại đây.', 'Beanbus will publish upcoming workshops and community events here.')}</p>
          </div>
        ) : <>
        <div className={styles.eventsGrid}>
          {events.map((item, index) => (
            <article key={item.id} className={styles.eventCard}>
              <div className={styles.imgBox}>
                <Image src={item.image} alt={item.titleVi} fill unoptimized={!isNextOptimizedImage(item.image)} loading={index === 0 ? 'eager' : 'lazy'} sizes="(max-width: 900px) 100vw, 50vw" className={styles.cardImg} />
                {item.isFeatured && (
                  <span className={styles.featuredBadge}><Star size={13} /> Featured Event</span>
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.metaRow}>
                  <span className={styles.metaItem}><Calendar size={14} /> {item.date}</span>
                  <span className={styles.metaItem}><Clock size={14} /> {item.time}</span>
                </div>

                <h3 className={styles.eventTitle}>
                  {lang === 'en' ? item.titleEn : item.titleVi}
                </h3>

                <p className={styles.eventDesc}>
                  {lang === 'en' ? item.summaryEn : item.summaryVi}
                </p>

                <div className={styles.location}>
                  <MapPin size={15} className={styles.locIcon} />
                  <span>{item.location}</span>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.seatInfo}>
                    <Users size={15} />
                    <span>
                      {isProduction
                        ? `${t('Tối đa', 'Up to')} ${item.maxSeats ?? '—'} ${t('chỗ', 'seats')}`
                        : `${item.registeredSeats} / ${item.maxSeats} ${t('chỗ đã đăng ký', 'seats registered')}`}
                    </span>
                  </div>
                  <div className={styles.eventActions}>
                    <Link href={`/events/${item.id}`} className={styles.detailLink}>
                      {t('Chi tiết', 'Details')} <ArrowRight size={15} />
                    </Link>
                    <RsvpButton event={item} />
                    <a href="/contact" className={`${styles.detailLink} noScriptInline`}>{t('Liên hệ đăng ký', 'Contact to RSVP')}</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        {totalPages > 1 && (
          <nav className={styles.pagination} aria-label={t('Phân trang sự kiện', 'Events pagination')}>
            {page > 1 && <Link href={`/events?page=${page - 1}`} aria-label={t('Trang sự kiện trước', 'Previous events page')}>←</Link>}
            <span>{t(`Trang ${page} / ${totalPages}`, `Page ${page} / ${totalPages}`)}</span>
            {page < totalPages && <Link href={`/events?page=${page + 1}`} aria-label={t('Trang sự kiện sau', 'Next events page')}>→</Link>}
          </nav>
        )}
        </>}
      </div>

    </div>
  );
}
