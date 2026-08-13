'use client';

import { useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Quote } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  applyNotificationRichTextCommand,
  type NotificationRichTextCommand,
} from '@/lib/notifications/rich-text';
import styles from './notification-center.module.css';

type Props = {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
};

const MAX_LENGTH = 1000;

export function RichTextEditor({ id, label, name, value, onChange }: Props) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commands: Array<{
    command: NotificationRichTextCommand;
    icon: typeof Bold;
    label: string;
  }> = [
    { command: 'bold', icon: Bold, label: t('In đậm', 'Bold') },
    { command: 'italic', icon: Italic, label: t('In nghiêng', 'Italic') },
    { command: 'bullet-list', icon: List, label: t('Danh sách dấu đầu dòng', 'Bulleted list') },
    { command: 'numbered-list', icon: ListOrdered, label: t('Danh sách đánh số', 'Numbered list') },
    { command: 'quote', icon: Quote, label: t('Trích dẫn', 'Quote') },
  ];

  const applyCommand = (command: NotificationRichTextCommand) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = applyNotificationRichTextCommand(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      command,
      t('văn bản', 'text'),
    );
    if (edit.value.length > MAX_LENGTH) return;
    onChange(edit.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  return (
    <div className={styles.richEditorField}>
      <div className={styles.fieldHeading}>
        <label htmlFor={id}>{label}</label>
        <span aria-live="polite">{value.length}/{MAX_LENGTH}</span>
      </div>
      <div className={styles.editorShell}>
        <div className={styles.editorToolbar} role="toolbar" aria-label={t('Định dạng nội dung', 'Content formatting')}>
          {commands.map(({ command, icon: Icon, label: commandLabel }) => (
            <button
              key={command}
              type="button"
              aria-label={commandLabel}
              title={commandLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand(command)}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          maxLength={MAX_LENGTH}
          rows={9}
          aria-required="true"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('Nhập nội dung và dùng thanh công cụ để định dạng...', 'Write the message and use the toolbar to format it...')}
        />
      </div>
    </div>
  );
}
