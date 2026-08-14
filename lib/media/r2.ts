import 'server-only';

import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSiteUrl } from '@/lib/env';
import { isManagedMediaKey, MAX_OUTPUT_BYTES, type MediaKind } from './r2-validation';

type R2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

function required(name: keyof R2Config): string {
  const value = name === 'accountId'
    ? process.env.R2_ACCOUNT_ID
    : name === 'bucketName'
      ? process.env.R2_BUCKET_NAME
      : name === 'accessKeyId'
        ? process.env.R2_ACCESS_KEY_ID
        : name === 'secretAccessKey'
          ? process.env.R2_SECRET_ACCESS_KEY
          : process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (!value?.trim()) throw new Error(`Missing R2 configuration: ${name}`);
  return value.trim();
}

export function getR2Config(): R2Config {
  const publicBaseUrl = required('publicBaseUrl').replace(/\/$/, '');
  const parsed = new URL(publicBaseUrl);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/') throw new Error('R2 public URL must be an HTTPS origin.');
  return {
    accountId: required('accountId'),
    bucketName: required('bucketName'),
    accessKeyId: required('accessKeyId'),
    secretAccessKey: required('secretAccessKey'),
    publicBaseUrl,
  };
}

function client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === 'NotFound' || value.$metadata?.httpStatusCode === 404;
}

export function createStagingKey(adminId: string, kind: MediaKind, id = crypto.randomUUID()): string {
  return `staging/${adminId}/${kind}/${id}.webp`;
}

export function createFinalMediaKey(kind: MediaKind, date = new Date(), id = crypto.randomUUID()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `media/${kind}/${year}/${month}/${id}.webp`;
}

export function publicMediaUrl(key: string): string {
  if (!isManagedMediaKey(key)) throw new Error('Invalid managed media key.');
  return `${getR2Config().publicBaseUrl}/${key}`;
}

export async function createMediaUpload(input: { adminId: string; kind: MediaKind }): Promise<{
  uploadUrl: string;
  stagingKey: string;
  finalKey: string;
  publicUrl: string;
  expiresAt: string;
}> {
  const config = getR2Config();
  const objectId = crypto.randomUUID();
  const stagingKey = createStagingKey(input.adminId, input.kind, objectId);
  const finalKey = createFinalMediaKey(input.kind, new Date(), objectId);
  const uploadUrl = await getSignedUrl(
    client(config),
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: stagingKey,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=300',
    }),
    { expiresIn: 300 },
  );
  return {
    uploadUrl,
    stagingKey,
    finalKey,
    publicUrl: `${config.publicBaseUrl}/${finalKey}`,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
}

export async function promoteMediaObject(input: { adminId: string; stagingKey: string; finalKey: string; contentLength: number }): Promise<string> {
  const config = getR2Config();
  const stagingParts = input.stagingKey.split('/');
  const stagingId = stagingParts[3]?.replace(/\.webp$/i, '');
  const stagingKind = stagingParts[2] as MediaKind | undefined;
  const finalParts = input.finalKey.split('/');
  if (stagingParts.length !== 4 || stagingParts[0] !== 'staging' || stagingParts[1] !== input.adminId || !stagingKind || !['product', 'event', 'blog'].includes(stagingKind) || !stagingId || !/^[0-9a-f-]{36}$/i.test(stagingId) || finalParts.length !== 5 || finalParts[0] !== 'media' || finalParts[1] !== stagingKind || finalParts[4] !== `${stagingId}.webp` || !isManagedMediaKey(input.finalKey)) {
    throw new Error('Invalid media object key.');
  }
  const storage = client(config);
  let head;
  try {
    head = await storage.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: input.stagingKey }));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    try {
      await storage.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: input.finalKey }));
      return `${config.publicBaseUrl}/${input.finalKey}`;
    } catch {
      throw error;
    }
  }
  if (head.ContentType !== 'image/webp' || head.ContentLength !== input.contentLength || input.contentLength <= 0 || input.contentLength > MAX_OUTPUT_BYTES) {
    throw new Error('Uploaded media metadata does not match.');
  }
  try {
    await storage.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: input.finalKey }));
    throw new Error('Final media object already exists.');
  } catch (error) {
    if (error instanceof Error && error.message === 'Final media object already exists.') throw error;
    if (!isNotFound(error)) throw error;
  }
  await storage.send(new CopyObjectCommand({
    Bucket: config.bucketName,
    Key: input.finalKey,
    CopySource: `${config.bucketName}/${input.stagingKey.split('/').map(encodeURIComponent).join('/')}`,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
    MetadataDirective: 'REPLACE',
  }));
  await storage.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: input.stagingKey }));
  return `${config.publicBaseUrl}/${input.finalKey}`;
}

export function isTrustedMediaOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = new Set([getSiteUrl(), 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:3100']);
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
