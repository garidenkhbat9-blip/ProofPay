import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoReducer,
  initialDemoWorkflow,
  demoUnlockedStage,
  type DemoWorkflow,
} from "../src/lib/demo-workflow";
const file = { name: "source.zip", size: 1024, sample: true };
function submitted(): DemoWorkflow {
  let state = demoReducer(initialDemoWorkflow, {
    type: "create",
    name: "Website",
    brief: "Three pages",
  });
  state = demoReducer(state, { type: "agree" });
  return demoReducer(state, {
    type: "submit",
    url: "https://example.com",
    notes: "Ready for review",
    files: [file],
  });
}
test("demo prevents skipping acceptance, evidence, review and payment prerequisites", () => {
  assert.equal(
    demoReducer(initialDemoWorkflow, { type: "navigate", stage: 5 }),
    initialDemoWorkflow,
  );
  assert.equal(
    demoReducer(initialDemoWorkflow, { type: "pay" }),
    initialDemoWorkflow,
  );
  assert.equal(
    demoReducer(initialDemoWorkflow, { type: "agree" }),
    initialDemoWorkflow,
  );
  const state = submitted();
  assert.equal(demoUnlockedStage(state), 3);
  assert.equal(
    demoReducer(state, {
      type: "approve",
      reviewed: true,
      acknowledged: true,
      note: "",
    }),
    state,
  );
  const verified = demoReducer(state, { type: "verify" });
  assert.equal(
    demoReducer(verified, {
      type: "approve",
      reviewed: false,
      acknowledged: true,
      note: "",
    }),
    verified,
  );
  assert.equal(
    demoReducer(verified, {
      type: "approve",
      reviewed: true,
      acknowledged: false,
      note: "",
    }),
    verified,
  );
});
test("revision preserves evidence history and requires a fresh report and review", () => {
  let state = demoReducer(submitted(), { type: "verify" });
  const previous = state.submissions[0];
  state = demoReducer(state, {
    type: "changes",
    note: "Optimize the hero image",
  });
  assert.equal(state.stage, 2);
  assert.equal(state.verifiedRevision, null);
  state = demoReducer(state, {
    type: "submit",
    url: "https://example.com/revised",
    notes: "Optimized",
    files: [file],
  });
  assert.equal(state.submissions.length, 2);
  assert.deepEqual(state.submissions[0], previous);
  assert.equal(state.submissions[1].revision, 2);
  assert.equal(state.verifiedRevision, null);
  assert.equal(state.decision, "pending");
});
test("approval does not pay and repeated simulated payment produces one record", () => {
  let state = demoReducer(submitted(), { type: "verify" });
  state = demoReducer(state, {
    type: "approve",
    reviewed: true,
    acknowledged: true,
    note: "Accepted",
  });
  assert.equal(state.paid, false);
  assert.equal(state.stage, 5);
  state = demoReducer(state, { type: "pay" });
  assert.equal(state.paid, true);
  assert.equal(demoReducer(state, { type: "pay" }), state);
});
test("invalid evidence and duplicate submissions do not advance the demo", () => {
  const current = submitted();
  assert.equal(
    demoReducer(current, {
      type: "submit",
      url: "https://example.com",
      notes: "Duplicate",
      files: [file],
    }),
    current,
  );
  const changes = demoReducer(demoReducer(current, { type: "verify" }), {
    type: "changes",
    note: "Revise",
  });
  assert.equal(
    demoReducer(changes, {
      type: "submit",
      url: "javascript:alert(1)",
      notes: "Unsafe",
      files: [file],
    }),
    changes,
  );
});
