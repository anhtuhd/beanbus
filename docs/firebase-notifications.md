# Firebase Web Push rollout

Keep every new feature flag off while applying the database migration and deploying the worker.

## Vercel

Configure these for Production and Preview as needed:

```env
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_GUEST_NOTIFICATIONS=false
NEXT_PUBLIC_ENABLE_WEB_PUSH=false
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
GUEST_NOTIFICATION_SECRET=
SUPABASE_SECRET_KEY=
```

Generate `GUEST_NOTIFICATION_SECRET` as at least 32 random bytes. It signs the seven-day HttpOnly guest cookie and must never use a `NEXT_PUBLIC_` name.

## Firebase project

1. Add a Firebase Web App for `beanbus.store` and copy its public config into the Vercel variables above.
2. Enable Firebase Cloud Messaging Registration API and Firebase Cloud Messaging API v1.
3. In Firebase Console, open **Project settings > Cloud Messaging > Web Push certificates** and create or import the VAPID key.
4. Create a dedicated Google Cloud service account with only the **Firebase Cloud Messaging API Admin** role.
5. Download its JSON once, base64-encode the complete file without changing it, and save that result only as the Edge Function secret below.

The Firebase service-account JSON and worker secret are server credentials. Do not add either value to Vercel or any `NEXT_PUBLIC_*` variable.

## Supabase Edge Function

Deploy `dispatch-fcm-notifications`, then configure:

```env
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=
FCM_WORKER_SECRET=
FCM_DELIVERY_MODE=disabled
FCM_ALLOWLIST_FIDS=
```

`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is the base64 form of the complete Firebase service-account JSON. Start with `FCM_DELIVERY_MODE=allowlist` and a comma-separated allowlist. Change it to `enabled` only after foreground and background delivery have both passed.

## Vault and cron

Store the same worker secret in Vault so `pg_cron` can invoke the Edge Function:

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('REPLACE_WITH_FCM_WORKER_SECRET', 'fcm_worker_secret');
```

The migration schedules the worker every minute and cleanup daily. No Vercel Cron is required.

## Rollout

1. Apply the migration with all flags off.
2. Deploy the worker and leave delivery disabled.
3. Enable in-app notifications.
4. Enable guest notifications and test one guest order in the same browser.
5. Enable Web Push with allowlist delivery on Chrome or Edge.
6. Switch delivery to `enabled` after admin, member, and guest smoke tests pass.

Disable guest and Web Push flags to roll back without affecting in-app notifications or Resend email.
