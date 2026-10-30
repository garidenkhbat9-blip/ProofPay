import { test } from "node:test";
import assert from "node:assert/strict";
import { createRefreshQueue, perspectiveKey, accountPerspective } from "../src/lib/workspace-sync";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("focus events share an in-flight read and respect the cooldown", async () => {
  const read = deferred();
  let calls = 0;
  let now = 0;
  const q = createRefreshQueue(async () => { calls++; await read.promise; }, () => now);
  const first = q.request(false);
  assert.equal(q.request(false), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  read.resolve();
  await first;
  now = 4999;
  await q.request(false);
  assert.equal(calls, 1);
  now = 5000;
  await q.request(false);
  assert.equal(calls, 2);
});

test("mutation refresh waits for one fresh read after an older read", async () => {
  const firstRead = deferred(), secondRead = deferred();
  let calls = 0;
  const q = createRefreshQueue(async () => {
    calls++;
    await (calls === 1 ? firstRead : secondRead).promise;
  });
  const initial = q.request(false);
  await Promise.resolve();
  let finished = false;
  const mutation = q.request().then(() => { finished = true; });
  void q.request();
  firstRead.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(finished, false);
  secondRead.resolve();
  await Promise.all([initial, mutation]);
  assert.equal(calls, 2);
  assert.equal(finished, true);
});

test("disposing an account cancels queued reads", async () => {
  const read = deferred();
  let calls = 0;
  const q = createRefreshQueue(async () => { calls++; await read.promise; });
  const pending = q.request();
  await Promise.resolve();
  void q.request();
  q.dispose();
  read.resolve();
  await pending;
  await q.request();
  assert.equal(calls, 1);
});

test("a failed read releases the queue for a manual retry", async () => {
  let calls = 0;
  const q = createRefreshQueue(async () => { if (++calls === 1) throw Error("Offline"); });
  await assert.rejects(q.request(), /Offline/);
  await q.request();
  assert.equal(calls, 2);
});

test("perspective preferences belong to each account with metadata fallback", () => {
  const stored = new Map([[perspectiveKey("a"), "freelancer"], ["proofpay-perspective", "freelancer"]]);
  assert.equal(accountPerspective(stored.get(perspectiveKey("a")) ?? null, "client"), "freelancer");
  assert.equal(accountPerspective(stored.get(perspectiveKey("b")) ?? null, "client"), "client");
  assert.equal(accountPerspective(null, "freelancer"), "freelancer");
  assert.equal(accountPerspective("invalid", undefined), "client");
});
