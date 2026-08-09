type Environment = Record<string, string | undefined>;

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${key}`);
  }

  return value;
}

export function validateSupabaseUrl(url: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL');
  }

  return url;
}

export function getSupabasePublicConfig(env: Environment = process.env): SupabasePublicConfig {
  const url = validateSupabaseUrl(required(env, 'NEXT_PUBLIC_SUPABASE_URL'));
  const publishableKey = required(env, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

  return { url, publishableKey };
}

export function getOptionalSupabasePublicConfig(
  env: Environment = process.env
): SupabasePublicConfig | null {
  const hasUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasKey = Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());

  if (!hasUrl && !hasKey) return null;

  return getSupabasePublicConfig(env);
}
