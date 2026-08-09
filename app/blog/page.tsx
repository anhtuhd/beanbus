'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { BLOG_POSTS } from '@/data/events';
import { Clock, User, ArrowRight } from 'lucide-react';
import styles from './blog.module.css';

export default function BlogPage() {
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
        <div className={styles.blogGrid}>
          {BLOG_POSTS.map((post) => (
            <div key={post.id} className={styles.postCard}>
              <div className={styles.imgBox}>
                <img src={post.coverImage} alt={post.titleVi} className={styles.postImg} />
                <span className={styles.categoryBadge}>
                  {lang === 'en' ? post.categoryEn : post.categoryVi}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.metaRow}>
                  <span><User size={13} /> {post.author}</span>
                  <span><Clock size={13} /> {post.readTime}</span>
                  <span>📅 {post.date}</span>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
