import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authOrigin, oauthDestination, readOAuthIntent } from "@/lib/google-auth";
import { oauthClient } from "@/lib/server/oauth";
export async function GET(request: Request) {
  let origin: string;
  try { origin = authOrigin(request.url); } catch { return new Response("Invalid application origin", { status: 400 }); }
  const jar = await cookies();
  let destination = "/login?oauth_error=confirmation";
  try {
    const url = new URL(request.url), code = url.searchParams.get("code");
    const attempt = jar.get("proofpay-oauth-attempt")?.value;
    if (!attempt || attempt !== url.searchParams.get("attempt")) throw Error("attempt");
    const intent = readOAuthIntent(jar.get("proofpay-oauth-intent")?.value, attempt);
    if (url.searchParams.has("error") || !code || code.length > 4096) throw Error("code");
    const client = await oauthClient(origin.startsWith("https:"));
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw Error("exchange");
    const verified = await client.auth.getUser(data.session.access_token);
    const user = verified.data.user;
    if (verified.error || !user?.email_confirmed_at || !user.email || user.id !== data.session.user.id) throw Error("identity");
    const profile = await client.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile.error || !profile.data) { destination = "/login?oauth_error=profile"; }
    else {
      if (intent && intent !== user.user_metadata?.preferred_workspace) {
        const saved = await client.auth.updateUser({ data: { preferred_workspace: intent } });
        if (saved.error || saved.data.user?.id !== user.id || saved.data.user.user_metadata?.preferred_workspace !== intent) throw Error("preference");
      }
      destination = oauthDestination(intent || user.user_metadata?.preferred_workspace);
    }
  } catch {   }
  jar.delete("proofpay-oauth-attempt");
  jar.delete("proofpay-oauth-intent");
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
