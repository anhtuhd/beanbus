import { validateSupabaseUrl } from './public-config.ts';

type Environment = Record<string, string | undefined>;

export type SupabaseAdminConfig = {
  url: string;
  secretKey: string;
};

export function getSupabaseAdminConfig(env: Environment): SupabaseAdminConfig {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl) {
    throw new Error('Missing required Supabase environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!secretKey) {
    throw new Error('Missing required Supabase environment variable: SUPABASE_SECRET_KEY');
  }

  return { url: validateSupabaseUrl(rawUrl), secretKey };
}
