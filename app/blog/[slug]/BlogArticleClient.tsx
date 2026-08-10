'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { BlogPost } from '@/data/events';
import { ArrowLeft, CalendarDays, Check, Clock, Share2, User } from 'lucide-react';
import styles from '../blog.module.css';

function inlineText(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part
  );
}

function ArticleContent({ content }: { content: string }) {
  return content.split(/\n{2,}/).map((block, index) => {
    if (block.startsWith('### ')) return <h2 key={index}>{inlineText(block.slice(4))}</h2>;
    const lines = block.split('\n');
    if (lines.every((line) => line.startsWith('- '))) {
      return <ul key={index}>{lines.map((line) => <li key={line}>{inlineText(line.slice(2))}</li>)}</ul>;
    }
    if (lines.every((line) => /^\d+\. /.test(line))) {
      return <ol key={index}>{lines.map((line) => <li key={line}>{inlineText(line.replace(/^\d+\. /, ''))}</li>)}</ol>;
    }
    return <p key={index}>{inlineText(block)}</p>;
  });
}

export default function BlogArticleClient({ post }: { post: BlogPost }) {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

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
            <span><Clock size={14} /> {lang === 'en' ? post.readTimeEn : post.readTime}</span>
            <span><CalendarDays size={14} /> {post.date}</span>
          </div>
        </div>

        <div className={styles.coverBox}>
          <Image src={post.coverImage} alt={post.titleVi} fill unoptimized loading="eager" sizes="(max-width: 800px) 100vw, 760px" className={styles.coverImg} />
        </div>

        <div className={styles.articleBody}><ArticleContent content={lang === 'en' ? post.contentEn : post.contentVi} /></div>

        <div className={styles.shareBox}>
          <span>{t('Chia sẻ bài viết:', 'Share article:')}</span>
          <button onClick={copyLink} aria-live="polite">
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? t('Đã sao chép', 'Copied') : t('Sao chép link', 'Copy link')}</span>
          </button>
        </div>
      </article>
    </div>
  );
}
