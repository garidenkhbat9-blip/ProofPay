import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Copy .env.example to .env.local, then restart the development server.",
    );
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: (url, options = {}) =>
        fetch(url, {
          ...options,
          signal: options.signal || AbortSignal.timeout(20000),
        }),
    },
  });
  return client;
}
