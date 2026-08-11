import type { AppRole } from './types.ts';
import { safeRedirectPath } from './input.ts';

export function resolvePostAuthPath(
  role: AppRole | null | undefined,
  requestedPath: string | null | undefined,
): string {
  if (role === 'admin') return '/admin';
  return safeRedirectPath(requestedPath ?? null);
}
