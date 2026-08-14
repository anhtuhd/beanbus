export type MediaKind = 'product' | 'event' | 'blog';

export const MEDIA_PRESETS: Record<MediaKind, {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}> = {
  product: { width: 1600, height: 1200, minWidth: 1200, minHeight: 900 },
  event: { width: 1600, height: 900, minWidth: 1280, minHeight: 720 },
  blog: { width: 1600, height: 900, minWidth: 1280, minHeight: 720 },
};

export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 25_000_000;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const ALLOWED_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MEDIA_KEY = /^media\/(product|event|blog|order)\/\d{4}\/\d{2}\/[0-9a-f-]+\.(?:webp|jpe?g|png)$/i;

export type MediaUploadMetadata = {
  kind: MediaKind;
  contentType: 'image/webp';
  size: number;
  width: number;
  height: number;
};

export function parseMediaKind(value: unknown): MediaKind | null {
  return value === 'product' || value === 'event' || value === 'blog' ? value : null;
}

export function validateMediaUploadMetadata(input: unknown): MediaUploadMetadata | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const kind = parseMediaKind(value.kind);
  const contentType = value.contentType;
  const size = value.size;
  const width = value.width;
  const height = value.height;
  if (!kind || contentType !== 'image/webp') return null;
  if (![size, width, height].every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0)) return null;
  const sizeNumber = size as number;
  const widthNumber = width as number;
  const heightNumber = height as number;
  if (sizeNumber > MAX_OUTPUT_BYTES || widthNumber * heightNumber > MAX_SOURCE_PIXELS) return null;
  const preset = MEDIA_PRESETS[kind];
  if (widthNumber !== preset.width || heightNumber !== preset.height || widthNumber < preset.minWidth || heightNumber < preset.minHeight) return null;
  return { kind, contentType, size: sizeNumber, width: widthNumber, height: heightNumber };
}

export function isAllowedSourceType(value: string): boolean {
  return ALLOWED_SOURCE_TYPES.has(value.toLowerCase());
}

export function isManagedMediaKey(value: string): boolean {
  return MEDIA_KEY.test(value);
}

export function isManagedMediaUrl(value: string, publicBaseUrl: string): boolean {
  try {
    const url = new URL(value);
    const base = new URL(publicBaseUrl);
    return url.origin === base.origin && isManagedMediaKey(url.pathname.slice(1));
  } catch {
    return false;
  }
}
