import { test } from "node:test";
import assert from "node:assert/strict";
import { createEvidenceFinalizer, type EvidenceSnapshot } from "../src/lib/evidence-submit";

test("a lost commit response retries the exact submission snapshot", async () => {
  const finalizer = createEvidenceFinalizer();
  const original = { p_submission_id: "s1", p_notes: "Original", p_artifacts: [{ kind: "url", url: "https://example.com/" }] };
  const calls: unknown[] = [];
  const send = async (snapshot: EvidenceSnapshot) => {
    calls.push(structuredClone(snapshot));
    if (calls.length === 1) throw Error("Response lost after commit");
  };
  await assert.rejects(finalizer.submit(original, send), /Response lost/);
  original.p_notes = "Edited after timeout";
  await finalizer.submit({ ...original, p_submission_id: "s2" }, send);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(finalizer.pending?.p_submission_id, "s1");
});

test("refresh failure after confirmed submission cannot send evidence twice", async () => {
  const finalizer = createEvidenceFinalizer();
  const snapshot = { p_submission_id: "s1", p_notes: "", p_artifacts: [] };
  let sends = 0;
  const send = async () => { sends++; };
  await finalizer.submit(snapshot, send);
  await finalizer.submit(snapshot, send);
  assert.equal(sends, 1);
});
