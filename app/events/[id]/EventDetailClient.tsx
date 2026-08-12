'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import type { EventItem } from '@/data/events';
import RsvpButton from '../RsvpButton';
import styles from '../events.module.css';
import { isNextOptimizedImage } from '@/lib/media/image';

export default function EventDetailClient({ event }: { event: EventItem }) {
  const { t, lang } = useLanguage();
  return (
    <div className={`wrap ${styles.detailPage}`}>
      <Link href="/events" className={styles.backLink}><ArrowLeft size={17} /> {t('Tất cả sự kiện', 'All events')}</Link>
      <article className={styles.detailLayout}>
        <div className={styles.detailImage}>
          <Image src={event.image} alt={event.titleVi} fill unoptimized={!isNextOptimizedImage(event.image)} loading="eager" sizes="(max-width: 800px) 100vw, 55vw" />
        </div>
        <div className={styles.detailContent}>
          <span className={styles.detailStatus}>{event.status === 'upcoming' ? t('Sắp diễn ra', 'Upcoming') : event.status}</span>
          <h1>{lang === 'en' ? event.titleEn : event.titleVi}</h1>
          <p className={styles.detailSummary}>{lang === 'en' ? event.summaryEn : event.summaryVi}</p>
          <div className={styles.detailMeta}>
            <span><Calendar size={17} /> {event.date}</span>
            <span><Clock size={17} /> {event.time}</span>
            <span><MapPin size={17} /> {event.location}</span>
            {event.maxSeats && <span><Users size={17} /> {t('Tối đa', 'Up to')} {event.maxSeats} {t('chỗ', 'seats')}</span>}
          </div>
          <p className={styles.detailDescription}>{lang === 'en' ? event.descriptionEn : event.descriptionVi}</p>
          <RsvpButton event={event} />
        </div>
      </article>
    </div>
  );
}
