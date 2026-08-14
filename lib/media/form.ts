import 'server-only';

import { promoteMediaObject } from './r2';
import { isManagedMediaKey, isManagedMediaUrl, type MediaKind } from './r2-validation';

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function resolveAdminMedia(formData: FormData, input: { name: string; kind: MediaKind; adminId: string }): Promise<string> {
  const currentUrl = value(formData, input.name);
  const stagingKey = value(formData, `${input.name}StagingKey`);
  const finalKey = value(formData, `${input.name}FinalKey`);
  const contentLength = Number(value(formData, `${input.name}ContentLength`));
  if (stagingKey || finalKey || contentLength) {
    if (!stagingKey.startsWith(`staging/${input.adminId}/${input.kind}/`) || !finalKey.startsWith(`media/${input.kind}/`) || !isManagedMediaKey(finalKey) || !Number.isInteger(contentLength) || contentLength <= 0) {
      throw new Error('INVALID_MEDIA_UPLOAD');
    }
    return promoteMediaObject({ adminId: input.adminId, stagingKey, finalKey, contentLength });
  }
  if (isManagedMediaUrl(currentUrl, process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? '') || /^https:\/\/images\.unsplash\.com\//i.test(currentUrl)) return currentUrl;
  throw new Error('INVALID_MEDIA_URL');
}
