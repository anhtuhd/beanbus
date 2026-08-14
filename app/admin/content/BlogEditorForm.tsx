'use client';

import { useActionState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { upsertAdminBlogPost } from './blog-actions';
import { initialContentEditorState } from './content-editor-state';
import styles from '../requests/requests.module.css';
import { LocalizedText } from '@/components/ui/LocalizedText';
import MediaUploader from '@/components/admin/MediaUploader';

type BlogPost = Pick<Database['public']['Tables']['blog_posts']['Row'], 'id' | 'slug' | 'title_vi' | 'title_en' | 'category_vi' | 'category_en' | 'author' | 'read_time_vi' | 'read_time_en' | 'excerpt_vi' | 'excerpt_en' | 'content_vi' | 'content_en' | 'cover_image_url' | 'is_published' | 'sort_order'>;

export default function BlogEditorForm({ post }: { post?: BlogPost }) {
  const [state, formAction, pending] = useActionState(upsertAdminBlogPost, initialContentEditorState);
  return (
    <form action={formAction} className={styles.productEditor}>
      <input type="hidden" name="postId" value={post?.id ?? ''} />
      <div className={styles.editorGrid}>
        <label>Slug<input name="slug" defaultValue={post?.slug ?? ''} pattern="[a-z0-9][a-z0-9-]*" required /></label>
        <label>Tiêu đề tiếng Việt<input name="titleVi" defaultValue={post?.title_vi ?? ''} maxLength={180} required /></label>
        <label>Tiêu đề tiếng Anh<input name="titleEn" defaultValue={post?.title_en ?? ''} maxLength={180} required /></label>
        <label>Danh mục VI<input name="categoryVi" defaultValue={post?.category_vi ?? ''} maxLength={80} required /></label>
        <label>Danh mục EN<input name="categoryEn" defaultValue={post?.category_en ?? ''} maxLength={80} required /></label>
        <label>Tác giả<input name="author" defaultValue={post?.author ?? ''} maxLength={100} required /></label>
        <label>Thời gian đọc VI<input name="readTimeVi" defaultValue={post?.read_time_vi ?? ''} maxLength={40} required /></label>
        <label>Thời gian đọc EN<input name="readTimeEn" defaultValue={post?.read_time_en ?? ''} maxLength={40} required /></label>
        <MediaUploader kind="blog" name="coverImageUrl" defaultValue={post?.cover_image_url ?? ''} required />
        <label>Thứ tự<input name="sortOrder" type="number" min="0" step="1" defaultValue={post?.sort_order ?? 0} required /></label>
      </div>
      <div className={styles.editorTextareas}>
        <label>Excerpt VI<textarea name="excerptVi" defaultValue={post?.excerpt_vi ?? ''} maxLength={500} rows={2} required /></label>
        <label>Excerpt EN<textarea name="excerptEn" defaultValue={post?.excerpt_en ?? ''} maxLength={500} rows={2} required /></label>
        <label>Nội dung VI<textarea name="contentVi" defaultValue={post?.content_vi ?? ''} maxLength={50000} rows={8} required /></label>
        <label>Nội dung EN<textarea name="contentEn" defaultValue={post?.content_en ?? ''} maxLength={50000} rows={8} required /></label>
      </div>
      <div className={styles.editorChecks}>
        <label><input type="checkbox" name="isPublished" defaultChecked={post?.is_published ?? false} /> Công khai</label>
        <button type="submit" className={styles.saveButton} disabled={pending}>{pending ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}<span><LocalizedText vi={pending ? 'Đang lưu' : 'Lưu bài viết'} en={pending ? 'Saving...' : 'Save post'} /></span></button>
      </div>
      {state.status !== 'idle' && <span className={state.status === 'error' ? styles.actionError : styles.actionSuccess} role={state.status === 'error' ? 'alert' : 'status'} aria-live={state.status === 'error' ? 'assertive' : 'polite'}>{state.message}</span>}
    </form>
  );
}
