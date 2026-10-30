import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  apiErrorResponse,
  readJsonBounded,
} from "../src/lib/api-http";

test("API errors never expose unexpected exception or credential details", async () => {
  const response = apiErrorResponse(
    new Error("provider key: secret-test-value"),
  );
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await response.text(), /secret-test-value|provider key/);
  const retry = apiErrorResponse(new ApiError(429, "Please wait."));
  assert.equal(retry.status, 429);
  assert.equal(retry.headers.get("retry-after"), "30");
});

test("JSON input size is bounded even without a content-length header", async () => {
  assert.deepEqual(
    await readJsonBounded(new Response('{"scope":"Website"}'), 100),
    { scope: "Website" },
  );
  await assert.rejects(readJsonBounded(new Response("x".repeat(101)), 100), {
    status: 413,
  });
  await assert.rejects(
    readJsonBounded(
      new Response("{}", { headers: { "content-length": "1000" } }),
      100,
    ),
    { status: 413 },
  );
  await assert.rejects(readJsonBounded(new Response('{"scope":'), 100), {
    status: 400,
  });
  await assert.rejects(readJsonBounded(new Response(null), 100), {
    status: 400,
  });
});
