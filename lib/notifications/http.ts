import { getSiteUrl } from '@/lib/env';
import { isTrustedMutationOrigin } from './validation';

export const MAX_NOTIFICATION_BODY_BYTES = 2048;

type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FEATURE_DISABLED'
  | 'INVALID_BODY'
  | 'INVALID_ORIGIN'
  | 'NOT_FOUND'
  | 'REQUEST_FAILED';

export function notificationError(code: ErrorCode, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function validateMutationRequest(request: Request): Response | null {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(contentLength) || contentLength > MAX_NOTIFICATION_BODY_BYTES) {
    return notificationError('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 413);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return notificationError('INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.', 415);
  }
  if (!isTrustedMutationOrigin(request.headers.get('origin'), getSiteUrl())) {
    return notificationError('INVALID_ORIGIN', 'Yêu cầu không hợp lệ.', 403);
  }
  return null;
}

export async function readBoundedJson(request: Request): Promise<unknown | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_NOTIFICATION_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
