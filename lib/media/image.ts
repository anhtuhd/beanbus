export function isNextOptimizedImage(source: string): boolean {
  if (source.startsWith('/')) return true;
  try {
    const hostname = new URL(source).hostname;
    return hostname === 'images.unsplash.com' || hostname === 'images.beanbus.store';
  } catch {
    return false;
  }
}
