import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestReviewerCode,
  verifyReviewerCode,
} from "../src/lib/reviewer-auth";
import { authenticationReturn } from "../src/lib/auth-navigation";

function fixture(
  options: {
    requestError?: unknown;
    verifyError?: unknown;
    noSession?: boolean;
    mismatch?: boolean;
    unconfirmed?: boolean;
  } = {},
) {
  const calls: [string, unknown][] = [];
  const client = {
    auth: {
      signInWithOtp: async (input: unknown) => {
        calls.push(["request", input]);
        return { error: options.requestError };
      },
      verifyOtp: async (input: unknown) => {
        calls.push(["verify", input]);
        return {
          error: options.verifyError,
          data: {
            session: options.noSession
              ? null
              : { access_token: "fixture-token", user: { id: "reviewer" } },
          },
        };
      },
      getUser: async (token: unknown) => {
        calls.push(["identity", token]);
        return {
          data: {
            user: {
              id: options.mismatch ? "other" : "reviewer",
              email: "reviewer@example.test",
              email_confirmed_at: options.unconfirmed ? null : "confirmed",
            },
          },
        };
      },
      signOut: async (input: unknown) => {
        calls.push(["signout", input]);
        return {};
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
test("reviewer code never creates users; both intended perspectives survive safe return", async () => {
  for (const role of ["client", "freelancer"]) {
    const { client, calls } = fixture();
    const next = `/dashboard?perspective=${role}`;
    await requestReviewerCode(
      client,
      " reviewer@example.test ",
      "https://proofpay.example",
      next,
    );
    assert.deepEqual(calls, [
      [
        "request",
        {
          email: "reviewer@example.test",
          options: {
            shouldCreateUser: false,
            emailRedirectTo:
              "https://proofpay.example/login?next=" + encodeURIComponent(next),
          },
        },
      ],
    ]);
    assert.equal(authenticationReturn(next, null), next);
  }
});
test("passwordless return rejects external and mutation routes", async () => {
  for (const next of ["https://evil.test", "//evil.test", "/api/payments"]) {
    const { client, calls } = fixture();
    await requestReviewerCode(
      client,
      "reviewer@example.test",
      "https://proofpay.example",
      next,
    );
    assert.equal(
      (calls[0][1] as { options: { emailRedirectTo: string } }).options
        .emailRedirectTo,
      "https://proofpay.example/login?next=%2Fdashboard",
    );
  }
});
test("unknown identity requests remain neutral; rate limits and delivery failures propagate", async () => {
  for (const code of ["signup_disabled", "user_not_found", "otp_disabled"])
    await requestReviewerCode(
      fixture({ requestError: { code } }).client,
      "unknown@example.test",
      "https://proofpay.example",
      "/dashboard",
    );
  for (const code of [
    "over_email_send_rate_limit",
    "over_request_rate_limit",
    "unexpected_failure",
  ]) {
    const error = { code };
    await assert.rejects(
      requestReviewerCode(
        fixture({ requestError: error }).client,
        "reviewer@example.test",
        "https://proofpay.example",
        "/dashboard",
      ),
      (e) => e === error,
    );
  }
});
test("code verification checks actual confirmed identity without membership or merchant mutations", async () => {
  const { client, calls } = fixture();
  await verifyReviewerCode(client, "Reviewer@example.test", "123456");
  assert.deepEqual(calls, [
    [
      "verify",
      { email: "Reviewer@example.test", token: "123456", type: "email" },
    ],
    ["identity", "fixture-token"],
  ]);
});
test("expired and invalid codes cannot report authentication success", async () => {
  const f = fixture();
  await assert.rejects(
    verifyReviewerCode(f.client, "reviewer@example.test", "bad"),
  );
  assert.equal(f.calls.length, 0);
  const error = { code: "otp_expired" };
  const expired = fixture({ verifyError: error });
  await assert.rejects(
    verifyReviewerCode(expired.client, "reviewer@example.test", "123456"),
    (e) => e === error,
  );
  assert.equal(expired.calls.length, 1);
  await assert.rejects(
    verifyReviewerCode(
      fixture({ noSession: true }).client,
      "reviewer@example.test",
      "123456",
    ),
  );
});
test("mismatched or unconfirmed accounts fail closed and clear the local session", async () => {
  for (const options of [{ mismatch: true }, { unconfirmed: true }]) {
    const { client, calls } = fixture(options);
    await assert.rejects(
      verifyReviewerCode(client, "reviewer@example.test", "123456"),
    );
    assert.deepEqual(calls.at(-1), ["signout", { scope: "local" }]);
  }
});
