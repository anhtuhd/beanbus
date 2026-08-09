type AuthOriginOptions = {
  configuredUrl?: string;
  fallbackOrigin?: string;
  production?: boolean;
};

export function resolveAuthOrigin({
  configuredUrl,
  fallbackOrigin = 'http://localhost:3000',
  production = process.env.NODE_ENV === 'production',
}: AuthOriginOptions = {}): string | null {
  const candidate = configuredUrl?.trim() || (production ? '' : fallbackOrigin);

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
