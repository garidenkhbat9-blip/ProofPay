import type { SupabaseClient } from "@supabase/supabase-js";
import { safeReturn } from "./domain";

// Supabase Auth enforces email delivery and verification limits server-side.
// Never use an admin client or create a reviewer identity implicitly.
export async function requestReviewerCode(
  client: SupabaseClient,
  email: string,
  origin: string,
  next: string,
) {
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo:
        origin + "/login?next=" + encodeURIComponent(safeReturn(next)),
    },
  });
  // Do not reveal whether an address is registered.
  if (
    error &&
    !["signup_disabled", "user_not_found", "otp_disabled"].includes(
      error.code || "",
    )
  )
    throw error;
}

export async function verifyReviewerCode(
  client: SupabaseClient,
  email: string,
  token: string,
) {
  if (!/^\d{6}$/.test(token.trim())) throw Error("invalid_code");
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  if (!data.session) throw Error("identity");
  const verified = await client.auth.getUser(data.session.access_token);
  if (
    verified.error ||
    !verified.data.user?.email_confirmed_at ||
    verified.data.user.id !== data.session.user.id ||
    verified.data.user.email?.toLowerCase() !== email.trim().toLowerCase()
  ) {
    await client.auth.signOut({ scope: "local" });
    throw Error("identity");
  }
}
