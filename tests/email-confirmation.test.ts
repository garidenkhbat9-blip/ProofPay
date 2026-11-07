import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmRegistration } from "../src/lib/email-confirmation";
import { authCooldown, observeAuthResponse } from "../src/lib/auth-cooldown";
test("confirmation uses token identity independently of existing browser session", async () => {
  for (const previous of [null, "client", "freelancer"]) {
    let calls = 0;
    const client = { auth: {
      verifyOtp: async (args: unknown) => { calls++; assert.deepEqual(args, { token_hash: "confirmation", type: "email" }); return { data: { session: { access_token: "new-token", user: { id: "new" } } } }; },
      getUser: async (token: string) => { assert.equal(token, "new-token"); return { data: { user: { id: "new", email_confirmed_at: "date", user_metadata: { preferred_workspace: "freelancer" } } } }; },
      getSession: () => { throw Error(String(previous)); },
    } } as unknown as SupabaseClient;
    assert.equal(await confirmRegistration(client, "confirmation"), "freelancer"); assert.equal(calls, 1);
    await assert.rejects(confirmRegistration(client, null), /missing/);
  }
});
test("invalid or replayed tokens cannot fall back to old sessions", async () => {
  const client = { auth: { verifyOtp: async () => ({ error: Error("expired") }) } } as unknown as SupabaseClient;
  await assert.rejects(confirmRegistration(client, "used"), /expired/);
});
test("429 cooldown honors Retry-After without issuing requests", () => {
  observeAuthResponse(new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
  assert(authCooldown() >= 119);
});
