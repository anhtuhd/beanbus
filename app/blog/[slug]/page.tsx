'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { BLOG_POSTS } from '@/data/events';
import { Clock, User, ArrowLeft, Share2 } from 'lucide-react';
import styles from '../blog.module.css';

export default function BlogPostDetail() {
  const params = useParams();
  const slug = params?.slug as string;
  const { t, lang } = useLanguage();

  const post = BLOG_POSTS.find((p) => p.slug === slug) || BLOG_POSTS[0];

  return (
    <div className={`wrap ${styles.articlePage}`}>
      <Link href="/blog" className={styles.backBtn}>
        <ArrowLeft size={18} />
        <span>{t('Quay lại danh sách bài viết', 'Back to Articles')}</span>
      </Link>

      <article className={styles.articleContainer}>
        <div className={styles.articleHeader}>
          <span className={styles.categoryBadge}>
            {lang === 'en' ? post.categoryEn : post.categoryVi}
          </span>
          <h1>{lang === 'en' ? post.titleEn : post.titleVi}</h1>
          <div className={styles.metaRow}>
            <span><User size={14} /> {post.author}</span>
            <span><Clock size={14} /> {post.readTime}</span>
            <span>📅 {post.date}</span>
          </div>
        </div>

        <div className={styles.coverBox}>
          <img src={post.coverImage} alt={post.titleVi} className={styles.coverImg} />
        </div>

        <div className={styles.articleBody}>
          {lang === 'en' ? post.contentEn : post.contentVi}
        </div>

        <div className={styles.shareBox}>
          <span>{t('Chia sẻ bài viết:', 'Share article:')}</span>
          <button onClick={() => alert('Đã sao chép liên kết!')}>
            <Share2 size={16} /> <span>{t('Sao chép link', 'Copy Link')}</span>
          </button>
        </div>
      </article>
    </div>
  );
}
