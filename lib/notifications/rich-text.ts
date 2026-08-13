export type NotificationRichTextCommand = 'bold' | 'italic' | 'bullet-list' | 'numbered-list' | 'quote';

export type NotificationInline = {
  text: string;
  bold: boolean;
  italic: boolean;
};

export type NotificationBlock =
  | { type: 'paragraph'; content: NotificationInline[] }
  | { type: 'quote'; content: NotificationInline[] }
  | { type: 'unordered-list'; items: NotificationInline[][] }
  | { type: 'ordered-list'; items: NotificationInline[][] };

export type RichTextEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function parseInline(value: string): NotificationInline[] {
  const segments: NotificationInline[] = [];
  const marker = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let cursor = 0;

  for (const match of value.matchAll(marker)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: value.slice(cursor, index), bold: false, italic: false });
    const token = match[0];
    const combined = token.startsWith('***');
    const bold = combined || token.startsWith('**');
    const markerLength = combined ? 3 : bold ? 2 : 1;
    segments.push({
      text: token.slice(markerLength, -markerLength),
      bold,
      italic: combined || !bold,
    });
    cursor = index + token.length;
  }

  if (cursor < value.length) segments.push({ text: value.slice(cursor), bold: false, italic: false });
  return segments.length > 0 ? segments : [{ text: value, bold: false, italic: false }];
}

export function parseNotificationRichText(value: string): NotificationBlock[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: NotificationBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const items: NotificationInline[][] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!item) break;
        items.push(parseInline(item[1]));
        index += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      const items: NotificationInline[][] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!item) break;
        items.push(parseInline(item[1]));
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    blocks.push({
      type: quote ? 'quote' : 'paragraph',
      content: parseInline(quote ? quote[1] : line.trim()),
    });
    index += 1;
  }

  return blocks;
}

export function notificationPlainText(value: string): string {
  return parseNotificationRichText(value)
    .flatMap((block) => block.type === 'unordered-list' || block.type === 'ordered-list'
      ? block.items
      : [block.content])
    .map((content) => content.map((segment) => segment.text).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyNotificationRichTextCommand(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: NotificationRichTextCommand,
  placeholder: string,
): RichTextEdit {
  if (command === 'bold' || command === 'italic') {
    const marker = command === 'bold' ? '**' : '*';
    const selected = value.slice(selectionStart, selectionEnd) || placeholder;
    return {
      value: `${value.slice(0, selectionStart)}${marker}${selected}${marker}${value.slice(selectionEnd)}`,
      selectionStart: selectionStart + marker.length,
      selectionEnd: selectionStart + marker.length + selected.length,
    };
  }

  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const nextBreak = value.indexOf('\n', selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const selected = value.slice(lineStart, lineEnd) || placeholder;
  const lines = selected.split('\n');
  const prefixed = lines.map((line, index) => {
    if (command === 'numbered-list') return `${index + 1}. ${line}`;
    return `${command === 'quote' ? '> ' : '- '}${line}`;
  }).join('\n');
  const addedCharacters = prefixed.length - selected.length;

  return {
    value: `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`,
    selectionStart: lineStart + (command === 'numbered-list' ? 3 : 2),
    selectionEnd: lineEnd + addedCharacters,
  };
}
