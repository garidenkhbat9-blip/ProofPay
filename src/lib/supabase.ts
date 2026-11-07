import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { observeAuthResponse } from "./auth-cooldown";
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Copy .env.example to .env.local, then restart the development server.",
    );
  client = createBrowserClient(url, key, {
    cookieOptions: { name: "proofpay-auth-v2", secure: typeof location !== "undefined" && location.protocol === "https:" },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (url, options = {}) => {
        const response = await fetch(url, {
          ...options,
          signal: options.signal || AbortSignal.timeout(20000),
        });
        if (String(url).includes("/auth/v1/")) observeAuthResponse(response);
        return response;
      },
    },
  });
  return client;
}
