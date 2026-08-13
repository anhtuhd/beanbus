'use client';

import { useActionState, useState } from 'react';
import { Check, Eye, Link as LinkIcon, Mail, Megaphone, Send } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { NotificationRichText } from '@/components/notifications/NotificationRichText';
import { RichTextEditor } from '@/components/notifications/RichTextEditor';
import { notificationPlainText } from '@/lib/notifications/rich-text';
import { initialAnnouncementState, publishAnnouncement } from './actions';
import styles from '@/components/notifications/notification-center.module.css';

type Locale = 'vi' | 'en';

const emptyDraft = {
  titleVi: '',
  titleEn: '',
  bodyVi: '',
  bodyEn: '',
  href: '',
  sendEmail: false,
};

export default function AnnouncementForm() {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState(publishAnnouncement, initialAnnouncementState);
  const [activeLocale, setActiveLocale] = useState<Locale>('vi');
  const [draft, setDraft] = useState(emptyDraft);
  const localeReady = {
    vi: draft.titleVi.trim().length >= 3 && notificationPlainText(draft.bodyVi).length >= 10,
    en: draft.titleEn.trim().length >= 3 && notificationPlainText(draft.bodyEn).length >= 10,
  };
  const readyToPublish = localeReady.vi && localeReady.en;
  const previewTitle = activeLocale === 'vi' ? draft.titleVi : draft.titleEn;
  const previewBody = activeLocale === 'vi' ? draft.bodyVi : draft.bodyEn;

  return (
    <form action={action} className={styles.announcementComposer}>
      <header className={styles.composerHeader}>
        <span className={styles.composerIcon}><Megaphone size={21} aria-hidden="true" /></span>
        <div>
          <h2>{t('Tạo thông báo cửa hàng', 'Create store announcement')}</h2>
          <p>{t('Soạn nội dung song ngữ và xem trước trước khi gửi tới toàn bộ hội viên.', 'Compose a bilingual message and preview it before publishing to all members.')}</p>
        </div>
      </header>

      <div className={styles.composerLayout}>
        <section className={styles.composerEditor} aria-labelledby="announcement-editor-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.stepNumber}>1</span>
              <h3 id="announcement-editor-title">{t('Soạn nội dung', 'Compose')}</h3>
            </div>
            <div className={styles.languageTabs} role="tablist" aria-label={t('Ngôn ngữ thông báo', 'Announcement language')}>
              {(['vi', 'en'] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  role="tab"
                  aria-selected={activeLocale === locale}
                  aria-controls={`announcement-panel-${locale}`}
                  id={`announcement-tab-${locale}`}
                  className={activeLocale === locale ? styles.activeLanguageTab : ''}
                  onClick={() => setActiveLocale(locale)}
                >
                  {locale === 'vi' ? 'VI' : 'EN'}
                  {localeReady[locale] && <Check size={13} aria-label={t('Đã hoàn thành', 'Complete')} />}
                </button>
              ))}
            </div>
          </div>

          <div
            id="announcement-panel-vi"
            role="tabpanel"
            aria-labelledby="announcement-tab-vi"
            hidden={activeLocale !== 'vi'}
            className={styles.languagePanel}
          >
            <div className={styles.fieldHeading}>
              <label htmlFor="announcement-title-vi">Tiêu đề tiếng Việt</label>
              <span>{draft.titleVi.length}/180</span>
            </div>
            <input id="announcement-title-vi" name="titleVi" value={draft.titleVi} minLength={3} maxLength={180} aria-required="true" onChange={(event) => setDraft({ ...draft, titleVi: event.target.value })} />
            <RichTextEditor id="announcement-body-vi" name="bodyVi" label="Nội dung tiếng Việt" value={draft.bodyVi} onChange={(bodyVi) => setDraft({ ...draft, bodyVi })} />
          </div>

          <div
            id="announcement-panel-en"
            role="tabpanel"
            aria-labelledby="announcement-tab-en"
            hidden={activeLocale !== 'en'}
            className={styles.languagePanel}
          >
            <div className={styles.fieldHeading}>
              <label htmlFor="announcement-title-en">English title</label>
              <span>{draft.titleEn.length}/180</span>
            </div>
            <input id="announcement-title-en" name="titleEn" value={draft.titleEn} minLength={3} maxLength={180} aria-required="true" onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })} />
            <RichTextEditor id="announcement-body-en" name="bodyEn" label="English content" value={draft.bodyEn} onChange={(bodyEn) => setDraft({ ...draft, bodyEn })} />
          </div>
        </section>

        <aside className={styles.composerPreview} aria-labelledby="announcement-preview-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.stepNumber}>2</span>
              <h3 id="announcement-preview-title">{t('Xem trước', 'Preview')}</h3>
            </div>
            <span className={styles.previewLanguage}><Eye size={14} /> {activeLocale.toUpperCase()}</span>
          </div>
          <div className={styles.previewCanvas} aria-live="polite">
            <article className={styles.previewNotification}>
              <span className={styles.previewIcon}><Megaphone size={18} aria-hidden="true" /></span>
              <div>
                <h4>{previewTitle.trim() || t('Tiêu đề thông báo', 'Announcement title')}</h4>
                {previewBody.trim() ? (
                  <NotificationRichText value={previewBody} />
                ) : (
                  <p className={styles.previewPlaceholder}>{t('Nội dung đã định dạng sẽ xuất hiện tại đây.', 'Your formatted message will appear here.')}</p>
                )}
                {draft.href && <span className={styles.previewLink}>{t('Xem chi tiết', 'View details')}</span>}
              </div>
            </article>
          </div>
          <p className={styles.previewNote}>{t('Preview mô phỏng trang thông báo hội viên. Chuông và push sẽ hiển thị bản rút gọn.', 'This preview matches the member notification page. The bell and push use a compact text version.')}</p>
        </aside>
      </div>

      <section className={styles.deliverySettings} aria-labelledby="announcement-delivery-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.stepNumber}>3</span><h3 id="announcement-delivery-title">{t('Phát hành', 'Delivery')}</h3></div>
        </div>
        <div className={styles.deliveryGrid}>
          <label className={styles.deliveryField}>
            <span><LinkIcon size={15} /> {t('Đường dẫn nội bộ', 'Internal link')} <small>{t('(không bắt buộc)', '(optional)')}</small></span>
            <input name="href" value={draft.href} maxLength={500} placeholder="/events" pattern="^/(?!/).*" onChange={(event) => setDraft({ ...draft, href: event.target.value })} />
          </label>
          <label className={styles.emailOption}>
            <input type="checkbox" name="sendEmail" checked={draft.sendEmail} onChange={(event) => setDraft({ ...draft, sendEmail: event.target.checked })} />
            <Mail size={17} aria-hidden="true" />
            <span><strong>{t('Gửi thêm qua email', 'Also send by email')}</strong><small>{t('Chỉ gửi tới hội viên đã đăng ký tin cửa hàng.', 'Only members subscribed to store news will receive it.')}</small></span>
          </label>
        </div>
      </section>

      <footer className={styles.composerFooter}>
        <p className={readyToPublish ? styles.readyHint : styles.incompleteHint}>
          {readyToPublish
            ? t('Nội dung hai ngôn ngữ đã sẵn sàng.', 'Both language versions are ready.')
            : t('Hoàn thành tiêu đề và nội dung ở cả tab VI và EN.', 'Complete the title and content in both VI and EN tabs.')}
        </p>
        <button type="submit" className={styles.publishButton} disabled={pending || !readyToPublish}>
          <Send size={17} aria-hidden="true" />
          {pending ? t('Đang phát hành...', 'Publishing...') : t('Phát hành thông báo', 'Publish announcement')}
        </button>
      </footer>
      {state.status !== 'idle' && <p className={styles.feedback} data-status={state.status} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
    </form>
  );
}
