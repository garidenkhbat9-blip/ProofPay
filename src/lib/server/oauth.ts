import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function oauthClient(secure: boolean) {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw Error("Authentication unavailable");
  return createServerClient(url, key, {
    cookieOptions: { name: "proofpay-auth-v2", secure },
    cookies: { getAll: () => jar.getAll(), setAll: values => { for (const { name, value, options } of values) jar.set(name, value, options); } },
    global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(20000) }) },
  });
}
