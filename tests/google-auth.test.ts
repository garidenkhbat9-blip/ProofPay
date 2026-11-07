import { test } from "node:test";
import assert from "node:assert/strict";
import { authOrigin, oauthDestination } from "../src/lib/google-auth";
import { createServerClient } from "@supabase/ssr";
test("Google redirects accept only the configured app origins and presentation roles", () => {
  for (const origin of ["https://proof-pay-beta.vercel.app", "http://localhost:3000"]) assert.equal(authOrigin(origin + "/auth/callback?next=https://evil.test"), origin);
  for (const origin of ["https://evil.test", "https://proof-pay-beta.vercel.app.evil.test", "http://proof-pay-beta.vercel.app"]) assert.throws(() => authOrigin(origin));
  assert.equal(oauthDestination("freelancer"), "/dashboard?perspective=freelancer");
  assert.equal(oauthDestination("client"), "/dashboard?perspective=client");
  assert.equal(oauthDestination("https://evil.test"), "/auth/workspace");
});
test("actual SSR SDK persists PKCE verifier and exchanged session in cookies without email requests", async () => {
  const jar = new Map<string, string>();
  const paths: string[] = [];
  const user = { id: "google-user", email: "judge@example.test", email_confirmed_at: "2026-11-07", user_metadata: {} };
  const make = () => createServerClient("https://fixture.supabase.co", "public-test-key", {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => { for (const c of values) jar.set(c.name, c.value); } },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input)); paths.push(url.pathname);
      if (url.pathname.endsWith("/token")) {
        const body = JSON.parse(String(options?.body));
        assert.equal(body.auth_code, "valid-code"); assert(body.code_verifier);
        return Response.json({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user });
      }
      assert(url.pathname.endsWith("/user")); return Response.json(user);
    } },
  });
  const start = make();
  const result = await start.auth.signInWithOAuth({ provider: "google", options: { skipBrowserRedirect: true, redirectTo: "http://localhost:3000/auth/callback", queryParams: { prompt: "select_account" } } });
  assert.equal(new URL(result.data.url!).searchParams.get("provider"), "google");
  assert([...jar.keys()].some(key => key.includes("code-verifier")));
  const callback = make();
  const exchanged = await callback.auth.exchangeCodeForSession("valid-code");
  assert.equal(exchanged.error, null); assert.equal(exchanged.data.user?.id, user.id);
  assert.equal((await callback.auth.getUser(exchanged.data.session!.access_token)).data.user?.email_confirmed_at, user.email_confirmed_at);
  assert([...jar].some(([name, value]) => name.includes("auth-token") && !name.includes("verifier") && value));
  assert(paths.every(path => !/signup|resend|verify/.test(path)));
});
