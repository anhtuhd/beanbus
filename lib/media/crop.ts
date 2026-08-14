import { MEDIA_PRESETS, MAX_OUTPUT_BYTES, MAX_SOURCE_BYTES, MAX_SOURCE_PIXELS, isAllowedSourceType, type MediaKind } from './r2-validation';

export type CropSelection = { offsetX: number; offsetY: number; zoom: number };

function cropRect(width: number, height: number, kind: MediaKind, selection: CropSelection) {
  const preset = MEDIA_PRESETS[kind];
  const targetRatio = preset.width / preset.height;
  const sourceRatio = width / height;
  const baseWidth = sourceRatio > targetRatio ? height * targetRatio : width;
  const baseHeight = sourceRatio > targetRatio ? height : width / targetRatio;
  const cropWidth = baseWidth / selection.zoom;
  const cropHeight = baseHeight / selection.zoom;
  const maxX = Math.max(0, (width - cropWidth) / 2);
  const maxY = Math.max(0, (height - cropHeight) / 2);
  return {
    x: Math.max(0, Math.min(width - cropWidth, (width - cropWidth) / 2 + selection.offsetX * maxX)),
    y: Math.max(0, Math.min(height - cropHeight, (height - cropHeight) / 2 + selection.offsetY * maxY)),
    width: cropWidth,
    height: cropHeight,
  };
}

export async function inspectSourceImage(file: File, kind: MediaKind): Promise<{ width: number; height: number }> {
  if (!isAllowedSourceType(file.type) || file.size > MAX_SOURCE_BYTES) throw new Error('SOURCE_IMAGE_INVALID');
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const preset = MEDIA_PRESETS[kind];
  if (dimensions.width * dimensions.height > MAX_SOURCE_PIXELS || dimensions.width < preset.minWidth || dimensions.height < preset.minHeight) {
    throw new Error('SOURCE_IMAGE_TOO_SMALL');
  }
  return dimensions;
}

export async function cropToWebp(file: File, kind: MediaKind, selection: CropSelection): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const preset = MEDIA_PRESETS[kind];
  const crop = cropRect(bitmap.width, bitmap.height, kind, selection);
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, preset.width, preset.height);
  bitmap.close();
  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= MAX_OUTPUT_BYTES) return blob;
  }
  throw new Error('OUTPUT_IMAGE_TOO_LARGE');
}
