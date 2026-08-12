export function isNextOptimizedImage(source: string): boolean {
  if (source.startsWith('/')) return true;
  try {
    return new URL(source).hostname === 'images.unsplash.com';
  } catch {
    return false;
  }
}
