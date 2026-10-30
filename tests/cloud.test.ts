import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCloud, rpc } from "../src/lib/cloud";
function client(failed: string[], code = "42P01"): SupabaseClient {
  return {
    from: (table: string) => ({
      select: async () =>
        failed.includes(table)
          ? { data: null, error: { code, message: "Unavailable " + table } }
          : { data: [], error: null },
    }),
  } as unknown as SupabaseClient;
}
test("core-table failure rejects the whole workspace instead of leaking stale data", async () => {
  await assert.rejects(loadCloud(client(["project_members"])), {
    message: "Unavailable project_members",
  });
});
test("optional-table network and permission failures reject partial snapshots", async () => {
  for (const code of ["", "42501", "PGRST301"]) {
    await assert.rejects(loadCloud(client(["agreement_approvals"], code)));
    await assert.rejects(loadCloud(client(["evidence_submissions"], code)));
  }
});
test("missing agreement and delivery migrations do not prevent project loading", async () => {
  const data = await loadCloud(client(["agreements", "evidence_submissions"]));
  assert.equal(data.agreementError, "Unavailable agreements");
  assert.equal(data.deliveryError, "Unavailable evidence_submissions");
  assert.deepEqual(data.projects, []);
});
test("RPC failures surface server authorization errors", async () => {
  const c = {
    rpc: async () => ({ data: null, error: { message: "Not authorized" } }),
  } as unknown as SupabaseClient;
  await assert.rejects(rpc(c, "create_project", {}), {
    message: "Not authorized",
  });
});
