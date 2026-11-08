import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_PAYMENT,
  initialDemoPayment,
  demoPaymentReducer as reduce,
  demoStatusLabels,
  demoAmount,
  type DemoPaymentAction,
  type DemoPaymentStatus,
} from "../src/lib/demo-payment";
import { safeReturn } from "../src/lib/domain";
test("sample is fictional USD 1000 minor units and starts ready without merchant/project input", () => {
  assert.deepEqual(DEMO_PAYMENT, {
    project: "Demo Website Design",
    milestone: "Homepage UI Design",
    amountMinor: 1000,
    currency: "USD",
  });
  assert(Number.isInteger(DEMO_PAYMENT.amountMinor));
  assert.equal(demoAmount(), "USD 10.00");
  assert.deepEqual(initialDemoPayment, { mode: "SIMULATION", status: "READY" });
});
test("invoice to payment completion is deterministic and cannot be a verified payment state", () => {
  let s = initialDemoPayment;
  for (const [action, status] of [
    ["CREATE_INVOICE", "INVOICE_CREATED"],
    ["REVIEW_INVOICE", "PAYMENT_PENDING"],
    ["CONFIRM", "PAID_SIMULATED"],
  ] as const) {
    s = reduce(s, action);
    assert.equal(s.status, status);
    assert.equal(s.mode, "SIMULATION");
    assert.match(demoStatusLabels[s.status], /simulated/);
  }
  assert.equal(
    demoStatusLabels[s.status],
    "Demo payment completed — simulated",
  );
  assert.equal(reduce(s, "CONFIRM"), s);
  assert.equal(reduce(s, "CANCEL"), s);
});
test("failure retries the same local flow; cancellation never completes a payment; reset is clean", () => {
  const pending = reduce(
    reduce(initialDemoPayment, "CREATE_INVOICE"),
    "REVIEW_INVOICE",
  );
  const failed = reduce(pending, "FAIL");
  assert.equal(failed.status, "FAILED_SIMULATED");
  assert.equal(reduce(failed, "RETRY").status, "PAYMENT_PENDING");
  for (const state of [
    reduce(initialDemoPayment, "CREATE_INVOICE"),
    pending,
    failed,
  ]) {
    const cancelled = reduce(state, "CANCEL");
    assert.equal(cancelled.status, "CANCELLED_SIMULATED");
    assert.equal(reduce(cancelled, "CONFIRM"), cancelled);
    assert.deepEqual(reduce(cancelled, "RESET"), initialDemoPayment);
  }
  assert.deepEqual(
    reduce(reduce(pending, "CONFIRM"), "RESET"),
    initialDemoPayment,
  );
  assert.equal(initialDemoPayment.status, "READY");
});
test("out-of-order and duplicate commands do not skip invoice or buyer review", () => {
  for (const action of [
    "CONFIRM",
    "FAIL",
    "RETRY",
    "CANCEL",
    "REVIEW_INVOICE",
  ] as DemoPaymentAction[])
    assert.equal(reduce(initialDemoPayment, action), initialDemoPayment);
  const invoice = reduce(initialDemoPayment, "CREATE_INVOICE");
  assert.equal(reduce(invoice, "CONFIRM"), invoice);
  assert.equal(reduce(invoice, "CREATE_INVOICE"), invoice);
  for (const status of [
    "PAID_SIMULATED",
    "CANCELLED_SIMULATED",
  ] as DemoPaymentStatus[])
    for (const action of [
      "CONFIRM",
      "CREATE_INVOICE",
      "REVIEW_INVOICE",
      "FAIL",
      "RETRY",
      "CANCEL",
    ] as DemoPaymentAction[]) {
      const state = { mode: "SIMULATION" as const, status };
      assert.equal(reduce(state, action), state);
    }
});
test("demo return path follows the existing login allowlist without broadening other payment paths", () => {
  assert.equal(safeReturn("/payments/demo"), "/payments/demo");
  assert.equal(safeReturn("/payments"), "/payments");
  for (const path of [
    "https://evil.example/payments/demo",
    "//evil.example/payments/demo",
    "/payments/demo/../invoice",
    "/payments/invoice",
    "/payments/demo-extra",
  ])
    assert.equal(safeReturn(path), "/dashboard");
});
