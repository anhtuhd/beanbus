import { createHash } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types.ts';

type MediaConfig = {
  table: 'products' | 'events' | 'blog_posts' | 'order_items';
  column: 'image_url' | 'cover_image_url';
  kind: 'product' | 'event' | 'blog' | 'order';
};

const CONFIG: MediaConfig[] = [
  { table: 'products', column: 'image_url', kind: 'product' },
  { table: 'events', column: 'image_url', kind: 'event' },
  { table: 'blog_posts', column: 'cover_image_url', kind: 'blog' },
  { table: 'order_items', column: 'image_url', kind: 'order' },
];

const apply = process.argv.includes('--apply');
const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!baseUrl || !supabaseUrl || !supabaseSecret || !accountId || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error('Missing R2 and Supabase migration environment variables.');
}

const supabase = createClient<Database>(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } });
const s3 = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
const untypedSupabase = supabase as unknown as {
  from(table: string): {
    select(columns: string): Promise<{ data: unknown[] | null; error: Error | null }>;
    update(values: Record<string, string>): { eq(column: string, value: string): Promise<{ error: Error | null }> };
  };
};

function extension(contentType: string, url: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/jpeg') return 'jpg';
  return /\.png(?:$|[?#])/i.test(url) ? 'png' : /\.webp(?:$|[?#])/i.test(url) ? 'webp' : 'jpg';
}

async function migrate(config: MediaConfig) {
  const result = await untypedSupabase.from(config.table).select(`id, ${config.column}`);
  if (result.error) throw result.error;
  let migrated = 0;
  for (const row of (result.data ?? []) as unknown as Array<{ id: string; image_url?: string | null; cover_image_url?: string | null }>) {
    const source = row[config.column];
    if (!source || source.startsWith(`${baseUrl}/media/`)) continue;
    const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Unable to download ${config.table}:${row.id} (${response.status})`);
    const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error(`Unsupported image type for ${config.table}:${row.id}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > 12 * 1024 * 1024) throw new Error(`Image too large for ${config.table}:${row.id}`);
    const digest = createHash('sha256').update(body).digest('hex');
    const date = new Date();
    const key = `media/${config.kind}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${digest}.${extension(contentType, source)}`;
    const publicUrl = `${baseUrl}/${key}`;
    if (apply) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public,max-age=31536000,immutable' }));
      const update = await untypedSupabase.from(config.table).update({ [config.column]: publicUrl }).eq('id', row.id);
      if (update.error) throw update.error;
    }
    migrated += 1;
    console.log(`${apply ? 'migrated' : 'would-migrate'} ${config.table}:${row.id}`);
  }
  console.log(`${config.table}: ${migrated} item(s)`);
}

console.log(apply ? 'Applying R2 media migration.' : 'Dry run only. Add --apply to upload and update metadata.');
for (const config of CONFIG) await migrate(config);
