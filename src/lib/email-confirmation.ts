import type { SupabaseClient } from "@supabase/supabase-js";
export async function confirmRegistration(client: SupabaseClient, token: string | null) {
  if (!token || token.length > 2048) throw Error("missing");
  const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: "email" });
  if (error) throw error;
  if (!data.session) throw Error("session");
  const verified = await client.auth.getUser(data.session.access_token);
  if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.id !== data.session.user.id) throw Error("identity");
  return verified.data.user.user_metadata?.preferred_workspace === "freelancer" ? "freelancer" : "client";
}
