'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import type { BlogPost } from '@/data/events';
import { ArrowRight, CalendarDays, Clock, User } from 'lucide-react';
import styles from './blog.module.css';
import { isNextOptimizedImage } from '@/lib/media/image';

export default function BlogListClient({ posts }: { posts: BlogPost[] }) {
  const { t, lang } = useLanguage();

  return (
    <div className={styles.blogPage}>
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Góc cà phê Beanbus', 'Beanbus Journal')}</span>
          </div>
          <h1 className={styles.title}>{t('Kiến Thức Cà Phê & Câu Chuyện Hạt', 'Coffee Knowledge & Stories')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Cùng Hiếu Bean và đội ngũ Barista khám phá bí quyết pha chế, cách thưởng thức và văn hóa cà phê đặc sản.',
              'Discover brewing tips, origin stories and coffee culture with Hiếu Bean and our barista team.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        {posts.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <Clock size={32} aria-hidden="true" />
            <h2>{t('Chưa có bài viết mới', 'No articles yet')}</h2>
            <p>{t('Các câu chuyện và kiến thức cà phê sẽ được cập nhật tại đây.', 'New coffee stories and knowledge will appear here.')}</p>
          </div>
        ) : <div className={styles.blogGrid}>
          {posts.map((post, index) => (
            <article key={post.id} className={styles.postCard}>
              <div className={styles.imgBox}>
                <Image src={post.coverImage} alt={post.titleVi} fill unoptimized={!isNextOptimizedImage(post.coverImage)} loading={index === 0 ? 'eager' : 'lazy'} sizes="(max-width: 768px) 100vw, 50vw" className={styles.postImg} />
                <span className={styles.categoryBadge}>
                  {lang === 'en' ? post.categoryEn : post.categoryVi}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.metaRow}>
                  <span><User size={13} /> {post.author}</span>
                  <span><Clock size={13} /> {lang === 'en' ? post.readTimeEn : post.readTime}</span>
                  <span><CalendarDays size={13} /> {post.date}</span>
                </div>

                <h3 className={styles.postTitle}>
                  {lang === 'en' ? post.titleEn : post.titleVi}
                </h3>

                <p className={styles.postExcerpt}>
                  {lang === 'en' ? post.excerptEn : post.excerptVi}
                </p>

                <Link href={`/blog/${post.slug}`} className={styles.readMoreLink}>
                  <span>{t('Đọc bài viết chi tiết', 'Read Full Article')}</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>}
      </div>
    </div>
  );
}
