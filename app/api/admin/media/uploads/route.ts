import { getCurrentProfile } from '@/lib/auth/session';
import { createMediaUpload, isTrustedMediaOrigin } from '@/lib/media/r2';
import { validateMediaUploadMetadata } from '@/lib/media/r2-validation';

const MAX_BODY_BYTES = 2048;

function error(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_R2_MEDIA !== 'true') {
    return error('FEATURE_DISABLED', 'Tải ảnh R2 chưa được bật.', 404);
  }
  if (!isTrustedMediaOrigin(request.headers.get('origin'))) {
    return error('INVALID_ORIGIN', 'Yêu cầu không hợp lệ.', 403);
  }
  const profile = await getCurrentProfile();
  if (!profile) return error('AUTH_REQUIRED', 'Bạn cần đăng nhập để tải ảnh.', 401);
  if (profile.role !== 'admin') return error('FORBIDDEN', 'Bạn không có quyền tải ảnh.', 403);

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (!rawBody.trim() || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return error('INVALID_BODY', 'Dữ liệu tải ảnh không hợp lệ.', 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return error('INVALID_BODY', 'Dữ liệu tải ảnh không hợp lệ.', 422);
  }
  const metadata = validateMediaUploadMetadata(body);
  if (!metadata) return error('INVALID_MEDIA', 'Ảnh cần là WebP hợp lệ, đúng tỷ lệ và không quá 2 MB.', 422);

  try {
    const result = await createMediaUpload({ adminId: profile.id, kind: metadata.kind });
    return Response.json({ ...result, requiredHeaders: { 'Content-Type': metadata.contentType, 'Cache-Control': 'private, max-age=300' } }, { status: 201 });
  } catch {
    return error('R2_UNAVAILABLE', 'Không thể tạo phiên tải ảnh lúc này.', 503);
  }
}
