import { cookies } from "next/headers";
import { authOrigin, workspaceIntent } from "@/lib/google-auth";
import { oauthClient } from "@/lib/server/oauth";
export async function POST(request: Request) {
  try {
    const origin = authOrigin(request.url);
    if (request.headers.get("origin") !== origin) return Response.json({ error: "Use ProofPay to sign in." }, { status: 403 });
    const body = await request.text();
    let role = null;
    if (body) {
      let input;
      try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid workspace choice." }, { status: 400 }); }
      role = workspaceIntent(input?.intent);
      if (input?.intent != null && !role) return Response.json({ error: "Invalid workspace choice." }, { status: 400 });
    }
    const jar = await cookies();
    if (jar.get("proofpay-oauth-attempt")) return Response.json({ error: "A Google sign-in is already in progress. Finish it, or wait ten minutes before trying again." }, { status: 409 });
    const attempt = crypto.randomUUID();
    const client = await oauthClient(origin.startsWith("https:"));
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: {
      redirectTo: origin + "/auth/callback?attempt=" + attempt,
      skipBrowserRedirect: true, queryParams: { prompt: "select_account" },
    } });
    if (error || !data.url) throw Error("provider");
    jar.set("proofpay-oauth-attempt", attempt, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
    jar.set("proofpay-oauth-intent", JSON.stringify({ attempt, role, expiresAt: Date.now() + 600000 }), { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
    return Response.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Google sign-in is unavailable. Check provider configuration or use email sign-in." }, { status: 503 }); }
}
