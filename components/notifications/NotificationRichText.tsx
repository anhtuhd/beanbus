import type { ReactNode } from 'react';
import { parseNotificationRichText, type NotificationInline } from '@/lib/notifications/rich-text';
import styles from './notification-center.module.css';

function renderInline(content: NotificationInline[], keyPrefix: string): ReactNode[] {
  return content.map((segment, index) => {
    let node: ReactNode = segment.text;
    if (segment.italic) node = <em>{node}</em>;
    if (segment.bold) node = <strong>{node}</strong>;
    return <span key={`${keyPrefix}-${index}`}>{node}</span>;
  });
}

export function NotificationRichText({ value, className = '' }: { value: string; className?: string }) {
  const blocks = parseNotificationRichText(value);
  return (
    <div className={`${styles.richText} ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === 'unordered-list' || block.type === 'ordered-list') {
          const List = block.type === 'ordered-list' ? 'ol' : 'ul';
          return (
            <List key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>{renderInline(item, `${index}-${itemIndex}`)}</li>
              ))}
            </List>
          );
        }
        if (block.type === 'quote') {
          return <blockquote key={`quote-${index}`}>{renderInline(block.content, `quote-${index}`)}</blockquote>;
        }
        return <p key={`paragraph-${index}`}>{renderInline(block.content, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}
