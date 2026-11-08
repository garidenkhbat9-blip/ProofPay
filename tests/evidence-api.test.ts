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
const project = "11111111-1111-4111-8111-111111111111",
  submission = "22222222-2222-4222-8222-222222222222";
const origin = "https://fake-supabase.example";
let sequence = 0;
async function fixture(
  options: {
    role?: string;
    outsider?: boolean;
    draft?: boolean;
    missing?: boolean;
    accepted?: boolean;
    unread?: boolean;
    wrongFile?: boolean;
    huge?: boolean;
    binary?: boolean;
    quota?: boolean;
    notes?: string;
    badCitation?: boolean;
    archived?: boolean;
    oldRevision?: boolean;
    oldAgreement?: boolean;
    malformed?: boolean;
    timeout?: boolean;
    changedDuring?: boolean;
  } = {},
) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fake-public-key";
  process.env.GEMINI_API_KEY = "fake-private-key";
  const userId = `33333333-3333-4333-8333-${String(++sequence).padStart(12, "0")}`;
  const calls: { url: URL; method: string }[] = [];
  let generated = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || "GET" });
    if (init.signal?.aborted) throw init.signal.reason;
    if (url.origin === origin) {
      if (
        !url.pathname.includes("/object/sign/proofpay-evidence/") ||
        init.method === "POST"
      )
        assert.equal(
          new Headers(init.headers).get("authorization"),
          "Bearer fake-user-token",
        );
      if (url.pathname === "/auth/v1/user")
        return Response.json({ id: userId, email_confirmed_at: "2026-11-01" });
      const table = url.pathname.split("/").pop();
      const rows: Record<string, unknown[]> = {
        project_members: options.outsider
          ? []
          : [{ role: options.role || "client" }],
        projects: [
          { id: project, status: options.archived ? "archived" : "active" },
        ],
        evidence_submissions: options.missing
          ? []
          : [
              {
                id: submission,
                project_id: project,
                milestone_id: "m",
                status: options.draft ? "uploading" : "submitted",
                revision: 2,
                notes: options.notes ?? "Author notes",
              },
            ],
        milestones: [{ id: "m", agreement_id: "a" }],
        agreements: [{ id: "a", version: 3, scope: "Deliver source code" }],
        agreement_approvals:
          options.accepted === false
            ? [{ role: "client" }]
            : [{ role: "client" }, { role: "freelancer" }],
        acceptance_criteria: [
          {
            id: "c",
            milestone_id: "m",
            position: 1,
            description: "Source code supplied",
          },
        ],
        evidence_artifacts: [
          {
            id: "file",
            submission_id: submission,
            kind: "file",
            label: "notes.txt",
            storage_path: `${submission}/notes.txt`,
            size_bytes: 20,
          },
          {
            id: "url",
            submission_id: submission,
            kind: "url",
            label: "Preview",
            url: "http://127.0.0.1/private",
            storage_path: null,
            size_bytes: null,
          },
        ],
      };
      if (url.pathname.startsWith("/rest/v1/")) {
        if (table === "evidence_submissions") {
          assert.equal(url.searchParams.get("project_id"), `eq.${project}`);
          if (url.searchParams.has("id"))
            assert.equal(url.searchParams.get("id"), `eq.${submission}`);
          else {
            assert.equal(url.searchParams.get("milestone_id"), "eq.m");
            if (options.oldRevision || (options.changedDuring && generated))
              return Response.json([{ id: "new", revision: 3 }]);
          }
        }
        if (
          table === "agreements" &&
          options.oldAgreement &&
          url.searchParams.get("order")
        )
          return Response.json([{ id: "new-agreement" }]);
        return Response.json(rows[table!] || []);
      }
      if (init.method === "POST") {
        assert.equal(JSON.parse(String(init.body)).expiresIn, 60);
        if (options.unread)
          return Response.json(
            { message: "private storage failure" },
            { status: 403 },
          );
        return Response.json({
          signedURL: `/object/sign/proofpay-evidence/${options.wrongFile ? "other/file.txt" : `${submission}/notes.txt`}?token=fake`,
        });
      }
      assert.equal(init.redirect, "error");
      return new Response(
        options.huge
          ? "x".repeat(32001)
          : options.binary
            ? new Uint8Array([0xff, 0xfe])
            : "Actual source text",
      );
    }
    assert.equal(
      url.origin,
      "https://generativelanguage.googleapis.com",
      "Never visit submitted URLs",
    );
    const payload = JSON.parse(String(init.body));
    const brief = JSON.parse(payload.contents[0].parts[0].text);
    assert(
      !JSON.stringify(brief).includes("127.0.0.1"),
      "URL content must never be supplied as read evidence",
    );
    if (options.quota)
      return Response.json(
        {
          error: {
            status: "RESOURCE_EXHAUSTED",
            message: "private provider details",
          },
        },
        { status: 429, headers: { "Retry-After": "120" } },
      );
    if (options.timeout) throw new DOMException("Timeout", "TimeoutError");
    if (options.malformed)
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: '{"unexpected":true}' }] },
          },
        ],
      });
    generated = true;
    const source =
      brief.sources.find((s: { id: string }) => s.id === "file") ||
      brief.sources[0];
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Human inspection is still needed.",
                  observations: [
                    {
                      criterion_id: "c",
                      status: "ATTENTION",
                      evidence_ids: [source.id],
                      limitations: ["Text only"],
                      observation: "Author claim only",
                      missing_evidence: "Human check needed",
                      questions: [],
                      citations: [
                        {
                          source_id: source.id,
                          quote: options.badCitation
                            ? "invented evidence"
                            : source.text,
                        },
                      ],
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  }) as typeof fetch;
  const { POST } =
    await import("../src/app/api/projects/[id]/submissions/[submissionId]/ai-review/route");
  const invoke = (submissionId = submission) =>
    POST(
      new Request(
        `https://app.example/api/projects/${project}/submissions/${submissionId}/ai-review`,
        {
          method: "POST",
          headers: { Authorization: "Bearer fake-user-token" },
        },
      ),
      { params: Promise.resolve({ id: project, submissionId }) },
    );
  return {
    calls,
    invoke,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
test("AI route denies freelancer, outsider, draft, missing submission and unaccepted terms before storage/provider access", async () => {
  for (const [options, expected] of [
    [{ role: "freelancer" }, 403],
    [{ outsider: true }, 404],
    [{ draft: true }, 404],
    [{ missing: true }, 404],
    [{ accepted: false }, 409],
  ] as const) {
    const f = await fixture(options);
    try {
      assert.equal((await f.invoke()).status, expected);
      assert(
        !f.calls.some(
          (c) =>
            c.url.pathname.includes("/storage/") ||
            c.url.hostname.includes("googleapis"),
        ),
      );
    } finally {
      f.restore();
    }
  }
});
test("AI route uses actual user bearer for private signing and returns revision-bound grounded report without writes", async () => {
  const f = await fixture();
  try {
    const response = await f.invoke();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.revision, 2);
    assert.equal(body.agreementVersion, 3);
    assert.equal(body.sources.length, 2);
    assert.equal(body.unread.length, 1);
    assert.match(body.sources[0].sha256, /^[a-f0-9]{64}$/);
    assert(
      !f.calls.some(
        (c) => c.url.pathname.startsWith("/rest/") && c.method !== "GET",
      ),
    );
    const again = await f.invoke();
    assert.equal(again.status, 429);
    assert.equal(again.headers.get("retry-after"), "60");
  } finally {
    f.restore();
  }
});
test("AI route treats storage denial, oversized bytes and invalid UTF-8 as unread evidence", async () => {
  for (const options of [{ unread: true }, { huge: true }, { binary: true }]) {
    const f = await fixture(options);
    try {
      const response = await f.invoke();
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.sources.length, 1);
      assert.equal(body.unread.length, 2);
    } finally {
      f.restore();
    }
  }
});
test("AI route refuses empty supported evidence, fabricated quotes and sanitizes provider quota errors", async () => {
  for (const [options, expected] of [
    [{ unread: true, notes: "" }, 422],
    [{ badCitation: true }, 502],
    [{ quota: true }, 429],
  ] as const) {
    const f = await fixture(options);
    try {
      const response = await f.invoke();
      assert.equal(response.status, expected);
      if ("quota" in options)
        assert.equal(response.headers.get("retry-after"), "120");
      assert.doesNotMatch(
        await response.text(),
        /private provider|fake-private|storage failure/,
      );
    } finally {
      f.restore();
    }
  }
});
test("AI route does not analyze a signed URL for a different object as the requested artifact", async () => {
  const f = await fixture({ wrongFile: true });
  try {
    const response = await f.invoke();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sources.length, 1);
    assert.equal(body.unread.length, 2);
  } finally {
    f.restore();
  }
});
test("AI route rejects malformed UUIDs before an evidence query", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.invoke("-".repeat(36))).status, 404);
    assert(
      !f.calls.some((c) => c.url.pathname.endsWith("/evidence_submissions")),
    );
  } finally {
    f.restore();
  }
});
test("AI route rejects archived, superseded revision and old agreement before provider access", async () => {
  for (const options of [
    { archived: true },
    { oldRevision: true },
    { oldAgreement: true },
  ]) {
    const f = await fixture(options);
    try {
      assert.equal((await f.invoke()).status, 409);
      assert(!f.calls.some((c) => c.url.hostname.includes("googleapis")));
    } finally {
      f.restore();
    }
  }
});
test("AI route fails closed on malformed output and provider connection failure", async () => {
  for (const [options, status] of [
    [{ malformed: true }, 502],
    [{ timeout: true }, 503],
  ] as const) {
    const f = await fixture(options);
    try {
      const response = await f.invoke();
      assert.equal(response.status, status);
      assert.doesNotMatch(await response.text(), /fake-private-key/);
    } finally {
      f.restore();
    }
  }
});

test("concurrent analysis requests call the provider once", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([f.invoke(), f.invoke()]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
    assert.equal(
      f.calls.filter((c) => c.url.hostname.includes("googleapis")).length,
      1,
    );
  } finally {
    f.restore();
  }
});
test("a revision arriving during generation invalidates the result", async () => {
  const f = await fixture({ changedDuring: true });
  try {
    assert.equal((await f.invoke()).status, 409);
    assert.equal(
      f.calls.filter((c) => c.url.hostname.includes("googleapis")).length,
      1,
    );
  } finally {
    f.restore();
  }
});
