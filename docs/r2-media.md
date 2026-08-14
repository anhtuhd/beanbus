# Beanbus media on Cloudflare R2

## Bucket setup

1. Create the R2 bucket `beanbus-media`.
2. Add the custom public domain `images.beanbus.store` and disable `r2.dev` after smoke testing.
3. Configure CORS for `PUT` from `https://www.beanbus.store` and local development origins, with `Content-Type` and `Cache-Control` request headers and `ETag` exposed.
4. Create an R2 access key limited to this bucket.

Vercel production variables:

```env
NEXT_PUBLIC_ENABLE_R2_MEDIA=true
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://images.beanbus.store
R2_ACCOUNT_ID=
R2_BUCKET_NAME=beanbus-media
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
CATALOG_MENU_MODE=legacy
```

The access key and secret are server-only. Never expose them through `NEXT_PUBLIC_*` or commit them.

## Upload flow

The admin browser asks `POST /api/admin/media/uploads` for a five-minute presigned PUT URL, uploads a cropped WebP directly to R2, then submits the staging key with the form. The server checks ownership, HEADs the object, promotes it to `media/<kind>/<yyyy>/<mm>/...`, and only then saves the URL in Supabase.

## Existing media migration

The migration script is intentionally dry-run by default. Run it from a shell with the R2 and Supabase variables loaded:

```bash
node --experimental-strip-types scripts/migrate-media-to-r2.ts
node --experimental-strip-types scripts/migrate-media-to-r2.ts --apply
```

The second command uploads existing product, event, blog and order-history images while preserving their original JPEG/PNG/WebP format. It uses a SHA-256 object name so retries are idempotent. Review the dry-run output and back up the mapping before using `--apply` in production.
