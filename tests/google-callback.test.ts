import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
registerHooks({ resolve(specifier, context, next) {
  const mock = specifier === "server-only" ? "server-only.cjs" : specifier === "next/headers" ? "oauth-cookies.mjs" : null;
  return mock ? { url: pathToFileURL(resolve("tests/support/" + mock)).href, shortCircuit: true } : next(specifier, context);
} });
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
const origin = "http://localhost:3000";
async function fixture(options: { unverified?: boolean; missingProfile?: boolean; invalidCode?: boolean } = {}) {
  const values = new Map<string, string>(); const calls: string[] = [];
  const jar = { get: (name: string) => values.has(name) ? { name, value: values.get(name)! } : undefined,
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => { values.set(name, value); }, delete: (name: string) => { values.delete(name); } };
  Object.assign(globalThis, { __oauthCookieJar: jar });
  const oldFetch = globalThis.fetch;
  const user = { id: "22222222-2222-4222-8222-222222222222", email: "google@example.test", email_confirmed_at: options.unverified ? null : "2026-11-07", user_metadata: { preferred_workspace: "freelancer" } };
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    if (path.endsWith("/token")) return options.invalidCode ? Response.json({ msg: "Invalid code", code: "bad_code_verifier" }, { status: 400 }) : Response.json({ access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user });
    if (path.endsWith("/user")) return Response.json(user);
    assert.equal(path, "/rest/v1/profiles"); return Response.json(options.missingProfile ? [] : { id: user.id });
  };
  const start = await import("../src/app/auth/google/route");
  const callback = await import("../src/app/auth/callback/route");
  return { jar, calls, start: (requestOrigin = origin) => start.POST(new Request(origin + "/auth/google", { method: "POST", headers: { origin: requestOrigin } })),
    callback: (query: string) => callback.GET(new Request(origin + "/auth/callback?" + query)), restore: () => { globalThis.fetch = oldFetch; } };
}
test("Google routes enforce origin, one pending attempt and valid callback binding", async () => {
  const f = await fixture(); try {
    assert.equal((await f.start("https://evil.test")).status, 403);
    assert.equal((await f.start()).status, 200);
    assert.equal((await f.start()).status, 409);
    const denied = await f.callback("code=stolen&attempt=wrong");
    assert.equal(new URL(denied.headers.get("location")!).pathname, "/login"); assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});
test("Google callback verifies session and profile before redirect; replay cannot reuse old session", async () => {
  const f = await fixture(); try {
    await f.start(); const attempt = f.jar.get("proofpay-oauth-attempt")!.value;
    const response = await f.callback("code=valid&attempt=" + attempt);
    assert.equal(response.headers.get("location"), origin + "/dashboard?perspective=freelancer");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert(f.calls.includes("/auth/v1/user")); assert(f.calls.includes("/rest/v1/profiles"));
    const count = f.calls.length;
    assert.equal(new URL((await f.callback("code=valid&attempt=" + attempt)).headers.get("location")!).pathname, "/login");
    assert.equal(f.calls.length, count);
  } finally { f.restore(); }
});
test("cancellation, failed code, unverified identity and profile failure never open workspace", async () => {
  for (const options of [{}, { invalidCode: true }, { unverified: true }, { missingProfile: true }]) {
    const f = await fixture(options); try {
      await f.start(); const attempt = f.jar.get("proofpay-oauth-attempt")!.value;
      const query = Object.keys(options).length ? "code=valid" : "error=access_denied";
      const response = await f.callback(query + "&attempt=" + attempt);
      assert.equal(new URL(response.headers.get("location")!).pathname, "/login");
      assert.equal(f.jar.get("proofpay-oauth-attempt"), undefined);
    } finally { f.restore(); }
  }
});
