import 'server-only';

import { cookies } from 'next/headers';
import { getSupabasePublicConfig } from './public-config.ts';
import { createSupabaseServerClient } from './server-client.ts';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig();

  return createSupabaseServerClient(config, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server Components cannot write cookies; root Proxy owns refresh writes.
      }
    },
  });
}
