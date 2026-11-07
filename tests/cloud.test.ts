import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCloud, rpc, errorMessage } from "../src/lib/cloud";
function client(failed: string[], code = "42P01"): SupabaseClient {
  return {
    from: (table: string) => ({
      select: () => ({ order() { return this; }, range: async () =>
        failed.includes(table)
          ? { data: null, error: { code, message: "Unavailable " + table } }
          : { data: [], count: 0, error: null } }),
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
  assert.match(data.agreementError, /Agreement storage is unavailable/);
  assert.match(data.deliveryError, /Evidence storage is unavailable/);
  assert.deepEqual(data.projects, []);
});

test("workspace reads every page even when the server caps pages below the requested limit", async () => {
  const rows = Array.from({length: 1205}, (_, i) => ({id: String(i)}));
  const c = {from: (table: string) => ({select: () => ({order() {return this;},
    range: async (start: number) => ({data: table === "projects" ? rows.slice(start, start + 100) : [], count: table === "projects" ? rows.length : 0, error: null})})})} as unknown as SupabaseClient;
  assert.equal((await loadCloud(c)).projects.length, 1205);
});

test("incomplete or concurrently changing workspace snapshots are rejected", async () => {
  for (const count of [null, 2, 10001]) {
    const c = {from: () => ({select: () => ({order() {return this;}, range: async (start: number) => ({data: start ? [] : [{id: "one"}], count, error: null})})})} as unknown as SupabaseClient;
    await assert.rejects(loadCloud(c));
  }
});

test("unexpected database diagnostics are not rendered to users", () => {
  for (const code of ["23514", "23505", "XX000", "42501", "PGRST205", ""]) {
    assert.doesNotMatch(errorMessage({code, message: "secret relation internal_table"}), /secret|internal_table/);
  }
  assert.equal(errorMessage({code: "P0001", message: "Both parties must accept this agreement first"}), "Both parties must accept this agreement first");
});
test("RPC failures surface server authorization errors", async () => {
  const c = {
    rpc: async () => ({ data: null, error: { message: "Not authorized" } }),
  } as unknown as SupabaseClient;
  await assert.rejects(rpc(c, "create_project", {}), {
    message: "Not authorized",
  });
});
test("workflow payment reads select only granted public fields and fail closed on incomplete access", async () => {
  const seen: string[] = [];
  const c = { from: (table: string) => ({ select: (columns: string) => {
    if (table === "payments") seen.push(columns);
    return { order() { return this; }, range: async () => ({ data: [], count: 0, error: null }) };
  } }) } as unknown as SupabaseClient;
  await loadCloud(c);
  assert.equal(seen.length, 1); assert.doesNotMatch(seen[0], /\*|merchant|lease|provider_snapshot|payer_email/);
  const missing = await loadCloud(client(["payments"])); assert(missing.paymentError); assert.equal(missing.deliveryError, "");
  await assert.rejects(loadCloud(client(["payments"], "42501")));
});
