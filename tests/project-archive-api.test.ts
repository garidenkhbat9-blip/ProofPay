import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
registerHooks({
  resolve(specifier, context, next) {
    return specifier === "server-only"
      ? {
          url: pathToFileURL(resolve("tests/support/server-only.cjs")).href,
          shortCircuit: true,
        }
      : next(specifier, context);
  },
});
const id = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
async function fixture(
  options: {
    role?: string;
    outsider?: boolean;
    creator?: boolean;
    confirmed?: boolean;
    rpcCode?: string;
    rpcMessage?: string;
    invalid?: boolean;
  } = {},
) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://archive-fixture.example";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  const original = globalThis.fetch,
    calls: { path: string; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://archive-fixture.example");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer caller-token",
    );
    calls.push({
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: actor,
        email_confirmed_at: options.confirmed === false ? null : "2026-11-01",
      });
    if (url.pathname.endsWith("project_members")) {
      assert.equal(url.searchParams.get("user_id"), `eq.${actor}`);
      return Response.json(
        options.outsider ? [] : [{ role: options.role || "client" }],
      );
    }
    if (url.pathname.endsWith("projects"))
      return Response.json(
        options.outsider
          ? []
          : [
              {
                id,
                status: "draft",
                created_by: options.creator === false ? "another-owner" : actor,
              },
            ],
      );
    assert(url.pathname.startsWith("/rest/v1/rpc/"));
    if (options.rpcCode)
      return Response.json(
        {
          code: options.rpcCode,
          message: options.rpcMessage || "private database details",
        },
        { status: 400 },
      );
    return Response.json(
      options.invalid
        ? {}
        : {
            available: true,
            status: "archived",
            revision: 1,
            archivedAt: "2026-11-06",
            canArchive: false,
            canReopen: true,
            reason: null,
            confirmed: true,
          },
    );
  };
  const routes = await import("../src/app/api/projects/[id]/archive/route");
  const invoke = (
    method: "GET" | "POST",
    body: unknown = { action: "archive", requestId, expectedRevision: 0 },
    headers: Record<string, string> = {},
  ) =>
    routes[method](
      new Request(`https://app.example/api/projects/${id}/archive`, {
        method,
        headers: { Authorization: "Bearer caller-token", ...headers },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      }),
      { params: Promise.resolve({ id }) },
    );
  return {
    invoke,
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}
test("archive route authorizes verified owner and sends only user-scoped RPC arguments", async () => {
  const f = await fixture();
  try {
    const response = await f.invoke("POST", {
      action: "archive",
      requestId,
      expectedRevision: 0,
      ownerId: "forged",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(f.calls.at(-1)?.body, {
      p_project_id: id,
      p_action: "archive",
      p_request_id: requestId,
      p_expected_revision: 0,
    });
    assert.equal((await response.json()).confirmed, true);
  } finally {
    f.restore();
  }
});
test("archive route denies outsiders, freelancers, wrong creators and unverified accounts before RPC", async () => {
  for (const [options, status] of [
    [{ outsider: true }, 404],
    [{ role: "freelancer" }, 403],
    [{ creator: false }, 403],
    [{ confirmed: false }, 403],
  ] as const) {
    const f = await fixture(options);
    try {
      assert.equal((await f.invoke("POST")).status, status);
      assert(!f.calls.some((c) => c.path.includes("/rpc/")));
    } finally {
      f.restore();
    }
  }
});
test("archive remains explicitly blocked without migration and never leaks database diagnostics", async () => {
  for (const rpcCode of ["PGRST202", "42883", "42703"]) {
    const f = await fixture({ rpcCode });
    try {
      const response = await f.invoke("GET");
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.equal(state.available, false);
      assert.equal(state.canArchive, false);
      assert.equal(state.reason, "SETUP_REQUIRED");
      const post = await f.invoke("POST");
      assert.equal(post.status, 503);
      assert.doesNotMatch(await post.text(), /private database/);
    } finally {
      f.restore();
    }
  }
});
test("stale and ineligible archive RPC results cannot appear successful", async () => {
  for (const reason of [
    "STALE",
    "PAYMENT_HISTORY",
    "DELIVERY_HISTORY",
    "INVITATION_PENDING",
    "AGREEMENT_ACCEPTED",
    "COLLABORATION_ACTIVE",
  ]) {
    const f = await fixture({
      rpcCode: "P0001",
      rpcMessage: `ARCHIVE_${reason}`,
    });
    try {
      assert.equal((await f.invoke("POST")).status, 409);
    } finally {
      f.restore();
    }
  }
  const f = await fixture({ invalid: true });
  try {
    assert.equal((await f.invoke("POST")).status, 503);
  } finally {
    f.restore();
  }
});
test("archive validates action IDs/revisions and rejects cross-origin or anonymous requests", async () => {
  const f = await fixture();
  try {
    for (const body of [
      null,
      {},
      { action: "delete", requestId, expectedRevision: 0 },
      { action: ["archive"], requestId, expectedRevision: 0 },
      { action: "archive", requestId: "bad", expectedRevision: 0 },
      { action: "reopen", requestId, expectedRevision: -1 },
    ])
      assert.equal((await f.invoke("POST", body)).status, 422);
    assert.equal(
      (await f.invoke("POST", {}, { Origin: "https://unrelated.example" }))
        .status,
      403,
    );
    assert.equal(
      (await f.invoke("POST", {}, { Authorization: "" })).status,
      401,
    );
    assert(!f.calls.some((c) => c.path.includes("/rpc/")));
  } finally {
    f.restore();
  }
});
