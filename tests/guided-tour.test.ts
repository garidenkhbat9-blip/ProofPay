import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readTourPreference, saveTourPreference, tourPreferenceKey, tourRecord, tourSteps, tourStorageKey, tourPlacement } from "../src/lib/guided-tour";

const completed = { status: "completed", version: 1, recorded_at: "2026-11-05T00:00:00.000Z" };
function fixture(options: { id?: string; metadata?: Record<string, unknown>; offline?: boolean; sessionId?: string } = {}) {
  const id = options.id || "client-a";
  const metadata = options.metadata || {};
  const client = { auth: {
    getSession: async () => ({ data: { session: { user: { id: options.sessionId || id }, access_token: "account-a-token" } }, error: null }),
    getUser: async (token: string) => { assert.equal(token, "account-a-token"); return { data: { user: { id, user_metadata: metadata } }, error: options.offline ? Error("offline") : null }; },
  } } as unknown as SupabaseClient;
  const rows = new Map<string, string>();
  const storage = { getItem: (key: string) => rows.get(key) || null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  return { client, metadata, rows, storage };
}

test("tour reads do not mark a first visit complete or skipped", async () => {
  const f = fixture();
  assert.equal(await readTourPreference(f.client, "client-a", "client", f.storage), "show");
  assert.equal(f.rows.size, 0);
  assert.deepEqual(f.metadata, {});
  for (const value of [true, "done", { ...completed, status: "started" }, { ...completed, recorded_at: "invalid" }, { ...completed, version: 2 }]) assert.equal(tourRecord(value), null);
});

test("completed and skipped tours survive a new session with empty browser storage", async () => {
  for (const status of ["completed", "skipped"]) {
    const f = fixture({ metadata: { [tourPreferenceKey("client")]: { ...completed, status } } });
    assert.equal(await readTourPreference(f.client, "client-a", "client", f.storage), "dismissed");
    assert.equal(await readTourPreference(f.client, "client-a", "client"), "dismissed");
    assert.equal(await readTourPreference(f.client, "client-a", "freelancer", f.storage), "show");
    const other = fixture({ id: "client-b" });
    assert.equal(await readTourPreference(other.client, "client-b", "client", f.storage), "show");
  }
  assert.notEqual(tourStorageKey("a", "client"), tourStorageKey("b", "client"));
  assert.notEqual(tourStorageKey("a", "client"), tourStorageKey("a", "freelancer"));
});

test("Finish and Skip save only the selected workspace using the verified account token", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of ["completed", "skipped"] as const) {
      const f = fixture({ metadata: { full_name: "Existing name", [tourPreferenceKey("freelancer")]: completed } });
      let writes = 0;
      globalThis.fetch = (async (_url, init) => {
        assert.equal(init?.method, "PUT");
        assert.equal(new Headers(init.headers).get("Authorization"), "Bearer account-a-token");
        const payload = JSON.parse(String(init.body));
        assert.deepEqual(Object.keys(payload.data), [tourPreferenceKey("client")]);
        assert.equal(payload.data[tourPreferenceKey("client")].status, status);
        Object.assign(f.metadata, payload.data); writes++;
        return Response.json({ id: "client-a", user_metadata: f.metadata });
      }) as typeof fetch;
      assert.deepEqual(await saveTourPreference(f.client, "client-a", "client", status, f.storage), { remote: true, local: true });
      assert.equal(writes, 1);
      assert.equal(f.metadata.full_name, "Existing name");
      assert.deepEqual(f.metadata[tourPreferenceKey("freelancer")], completed);
      assert.equal(await readTourPreference(f.client, "client-a", "client"), "dismissed");
    }
  } finally { globalThis.fetch = original; }
});

test("failed saves keep an account-scoped dismissal and retry on the next preference read", async () => {
  const original = globalThis.fetch, f = fixture();
  try {
    globalThis.fetch = async () => { throw Error("offline"); };
    assert.deepEqual(await saveTourPreference(f.client, "client-a", "client", "skipped", f.storage), { remote: false, local: true });
    assert.equal(await readTourPreference(f.client, "client-a", "client", f.storage), "dismissed");
    let writes = 0;
    globalThis.fetch = async (_url, init) => {
      Object.assign(f.metadata, JSON.parse(String(init?.body)).data); writes++;
      return Response.json({ id: "client-a", user_metadata: f.metadata });
    };
    assert.equal(await readTourPreference(f.client, "client-a", "client", f.storage), "dismissed");
    assert.equal(writes, 1);
    assert.equal(await readTourPreference(f.client, "client-a", "client"), "dismissed");
  } finally { globalThis.fetch = original; }
});

test("unknown Auth state never flashes a first-time tour; unavailable storage does not fake success", async () => {
  const offline = fixture({ offline: true });
  const denied = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
  assert.equal(await readTourPreference(offline.client, "client-a", "client", denied), "unavailable");
  assert.deepEqual(await saveTourPreference(offline.client, "client-a", "client", "completed", denied), { remote: false, local: false });
  assert.equal(await readTourPreference(fixture().client, "client-a", "client", denied), "show");
});

test("account switches never send the previous user's preference to another account", async () => {
  const original = globalThis.fetch;
  try {
    let writes = 0;
    globalThis.fetch = async () => { writes++; return Response.json({}); };
    const f = fixture({ sessionId: "client-b" });
    assert.equal(await readTourPreference(f.client, "client-a", "client"), "unavailable");
    assert.deepEqual(await saveTourPreference(f.client, "client-a", "client", "skipped"), { remote: false, local: false });
    assert.equal(writes, 0);
  } finally { globalThis.fetch = original; }
});

test("role-specific steps separate client creation from freelancer delivery", () => {
  assert(tourSteps("client").some((s) => s.target === "new-project"));
  assert(!tourSteps("freelancer").some((s) => s.target === "new-project"));
  assert.match(tourSteps("freelancer").map((s) => s.description).join(" "), /assigned delivery link/);
  for (const role of ["client", "freelancer"] as const) {
    assert.equal(tourSteps(role).at(-1)?.target, undefined);
    assert.match(tourSteps(role).map((s) => s.description).join(" "), /PayPal Sandbox/);
  }
});

test("popover placement stays inside mobile, tablet, desktop and offset viewports", () => {
  for (const width of [320, 768, 1440]) for (const height of [360, 900]) {
    const panel = { width: Math.min(360, width - 24), height: 300 };
    for (const target of [null, { left: 8, top: 10, width: 150, height: 40 }, { left: width - 150, top: height - 50, width: 140, height: 40 }]) {
      const pos = tourPlacement(target, panel, { width, height });
      assert(pos.left >= 12 && pos.top >= 12);
      assert(pos.left + panel.width <= width - 12 && pos.top + panel.height <= height - 12);
    }
  }
  const pos = tourPlacement(null, { width: 280, height: 240 }, { width: 320, height: 360, left: 100, top: 200 });
  assert(pos.left >= 112 && pos.top >= 212);
});
