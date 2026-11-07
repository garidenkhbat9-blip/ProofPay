import type { SupabaseClient } from "@supabase/supabase-js";
import { workspaceIntent, type WorkspaceIntent } from "./google-auth";

/** Pin writes to a verified identity even if another tab switches accounts. */
export async function saveWorkspacePreference(client: SupabaseClient, expectedId: string, role: WorkspaceIntent) {
  if (!workspaceIntent(role)) throw Error("Choose a valid workspace.");
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== expectedId) throw Error("Your account changed. Please sign in again.");
  const token = session.data.session.access_token;
  const verified = await client.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== expectedId || !verified.data.user.email_confirmed_at) throw Error("Please confirm your account before continuing.");
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    method: "PUT", headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { preferred_workspace: role } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Your workspace preference could not be saved. Please try again.");
  const saved = await response.json();
  if (saved.id !== expectedId || saved.user_metadata?.preferred_workspace !== role) throw Error("Your preference could not be confirmed.");
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== expectedId) throw Error("Your account changed. Please refresh.");
}
