import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentConfig, PAYPAL_BASE, assertConfiguredFreelancer } from "../src/lib/payments/config";
import { PaymentError, databasePaymentError, providerError } from "../src/lib/payments/errors";
import { invoiceBody, verifyInvoice, checkoutUrl, type Payment, type PayPalInvoice } from "../src/lib/payments/model";
import { PayPalGateway } from "../src/lib/payments/gateway";
import { runPayment, type PaymentStore, type InvoiceGateway } from "../src/lib/payments/workflow";
import { processWebhook, webhookIdentity, type WebhookWork } from "../src/lib/payments/webhook";

const env = { PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "fake-client", PAYPAL_CLIENT_SECRET: "fake-secret", PAYPAL_WEBHOOK_ID: "fake-webhook",
  PAYPAL_MERCHANT_ID: "ABCDEFGHIJKLM", PAYPAL_MERCHANT_EMAIL: "seller@example.test", PAYPAL_FREELANCER_USER_ID: "11111111-1111-4111-8111-111111111111" };
const config = paymentConfig(env);
const invoiceId = "INV2-ABCD-EFGH-IJKL-MNOP";
function payment(): Payment { return {
  id: "pay", project_id: "project", milestone_id: "milestone", agreement_id: "agreement", submission_id: "submission",
  freelancer_id: config.freelancerId, payer_id: "client", payer_email: "buyer@example.test", merchant_id: config.merchantId,
  merchant_email: config.merchantEmail, credential_fingerprint: "a".repeat(64), amount: "100.00", currency: "USD",
  invoice_number: "PP-one-operation", operation_id: "operation-1", paypal_invoice_id: null, status: "NOT_STARTED", provider_status: null,
  create_attempted_at: null, checkout_url: null, last_verified_at: null, paid_at: null, created_at: "2026-10-29", reconciliation_status: "NEVER_CHECKED", last_error: null,
}; }
function invoice(status = "DRAFT"): PayPalInvoice { return {
  id: invoiceId, status, amount: { value: "100.00", currency_code: "USD" }, due_amount: { value: status === "PAID" ? "0.00" : "100.00", currency_code: "USD" },
  detail: { invoice_number: "PP-one-operation", reference: "operation-1", currency_code: "USD", metadata: { recipient_view_url: "https://www.sandbox.paypal.com/invoice/p/#TEST" } },
  invoicer: { email_address: "seller@example.test" }, primary_recipients: [{ billing_info: { email_address: "buyer@example.test" } }],
  ...(status === "PAID" ? { payments: { transactions: [{ type: "PAYPAL", payment_id: "transaction-1", amount: { value: "100.00", currency_code: "USD" } }] } } : {}),
}; }
const code = (expected: string) => (error: unknown) => error instanceof PaymentError && error.diagnostic.code === expected;

test("payment configuration fails closed for every missing setting and for live mode", () => {
  for (const name of Object.keys(env)) assert.throws(() => paymentConfig({ ...env, [name]: "" }), PaymentError);
  assert.throws(() => paymentConfig({ ...env, PAYPAL_ENV: "live" }), code("PAYPAL_CONFIG_MISSING"));
  assert.throws(() => paymentConfig({ ...env, PAYPAL_WEBHOOK_ID: "" }), code("PAYPAL_CONFIG_MISSING"));
  assert.throws(() => paymentConfig({ ...env, PAYPAL_MERCHANT_ID: "invalid" }), code("PAYMENT_MERCHANT_NOT_CONFIGURED"));
});
test("invoice uses the immutable milestone snapshot and refuses invalid amount/currency/recipient", () => {
  assert.equal(invoiceBody(payment(), "Work").items[0].unit_amount.value, "100.00");
  for (const amount of [0, -1, 1.001, NaN, Infinity]) assert.throws(() => invoiceBody({ ...payment(), amount }, "Work"), code("PAYPAL_INVALID_AMOUNT"));
  assert.throws(() => invoiceBody({ ...payment(), currency: "EUR" }, "Work"), code("PAYPAL_CURRENCY_UNSUPPORTED"));
  for (const payer_email of ["not-an-email", config.merchantEmail]) assert.throws(() => invoiceBody({ ...payment(), payer_email }, "Work"), code("PAYPAL_INVALID_RECIPIENT"));
});
test("provider states map explicitly without treating manual/external payments as PayPal paid", () => {
  const map: Record<string, string> = { DRAFT: "DRAFT", SENT: "UNPAID", UNPAID: "UNPAID", SHARED: "UNPAID", SCHEDULED: "PAYMENT_PENDING", PAYMENT_PENDING: "PAYMENT_PENDING", PARTIALLY_PAID: "PAYMENT_PENDING", CANCELLED: "CANCELLED", AUTO_CANCELLED: "CANCELLED", MARKED_AS_PAID: "REQUIRES_ATTENTION", PAID_EXTERNAL: "REQUIRES_ATTENTION", MARKED_AS_REFUNDED: "REQUIRES_ATTENTION", REFUNDED_EXTERNAL: "REQUIRES_ATTENTION", PARTIALLY_REFUNDED: "REQUIRES_ATTENTION", UNKNOWN: "REQUIRES_ATTENTION" };
  for (const [status, expected] of Object.entries(map)) assert.equal(verifyInvoice(payment(), invoice(status)).status, expected, status);
  const conflicting = invoice("UNPAID"); conflicting.due_amount!.value = "0.00";
  assert.equal(verifyInvoice(payment(), conflicting).status, "REQUIRES_ATTENTION");
});
test("PAID requires real PayPal transactions, exact totals and no remaining balance", () => {
  assert.equal(verifyInvoice(payment(), invoice("PAID")).status, "PAID");
  for (const alter of [
    (i: PayPalInvoice) => { delete i.payments; },
    (i: PayPalInvoice) => { i.payments!.transactions![0].type = "EXTERNAL"; },
    (i: PayPalInvoice) => { i.payments!.transactions![0].amount!.value = "99.00"; },
    (i: PayPalInvoice) => { delete i.payments!.transactions![0].payment_id; },
    (i: PayPalInvoice) => { i.payments!.transactions!.push(i.payments!.transactions![0]); },
    (i: PayPalInvoice) => { i.due_amount!.value = "1.00"; },
    (i: PayPalInvoice) => { i.payments!.paid_amount = { value: "99.00", currency_code: "USD" }; },
    (i: PayPalInvoice) => { i.refunds = { refund_amount: { value: "20.00", currency_code: "USD" } }; },
  ]) { const i = invoice("PAID"); alter(i); assert.equal(verifyInvoice(payment(), i).status, "REQUIRES_ATTENTION"); }
});
test("unrelated invoice identity, ownership, payer, reference and financial mismatches cannot mark paid", () => {
  for (const alter of [
    (i: PayPalInvoice) => { i.id = "INV2-OTHER-INVOICE"; },
    (i: PayPalInvoice) => { i.invoicer!.email_address = "other@example.test"; },
    (i: PayPalInvoice) => { i.primary_recipients![0].billing_info!.email_address = "other@example.test"; },
    (i: PayPalInvoice) => { i.amount!.value = "101.00"; },
    (i: PayPalInvoice) => { i.amount!.currency_code = "EUR"; },
    (i: PayPalInvoice) => { i.detail!.reference = "other-operation"; },
    (i: PayPalInvoice) => { i.detail!.invoice_number = "other-number"; },
  ]) { const i = invoice("PAID"); alter(i); assert.throws(() => verifyInvoice({ ...payment(), paypal_invoice_id: invoiceId }, i), PaymentError); }
});
test("refunds require provider refund transactions and stale unpaid reads do not erase paid", () => {
  const i = invoice("REFUNDED");
  assert.equal(verifyInvoice(payment(), i).status, "REQUIRES_ATTENTION");
  i.refunds = { transactions: [{ type: "PAYPAL", refund_id: "refund-1", amount: { value: "100.00", currency_code: "USD" } }] };
  assert.equal(verifyInvoice(payment(), i).status, "REFUNDED");
  assert.equal(verifyInvoice({ ...payment(), status: "PAID" }, invoice("UNPAID")).status, "REQUIRES_ATTENTION");
  assert.equal(verifyInvoice({ ...payment(), status: "REFUNDED" }, invoice("PAID")).status, "REQUIRES_ATTENTION");
  assert.equal(verifyInvoice({ ...payment(), status: "REQUIRES_ATTENTION", paid_at: "2026-10-29" }, invoice("UNPAID")).status, "REQUIRES_ATTENTION");
  assert.equal(verifyInvoice({ ...payment(), status: "REQUIRES_ATTENTION", refunded_at: "2026-10-29" }, invoice("PAID")).status, "REQUIRES_ATTENTION");
});
test("checkout URLs cannot reach live PayPal, non-PayPal hosts or credential-bearing URLs", () => {
  for (const url of ["https://www.paypal.com/invoice/p/#x", "https://www.sandbox.paypal.com.evil.test/invoice/x", "javascript:alert(1)", "https://user@www.sandbox.paypal.com/invoice/x", "http://www.sandbox.paypal.com/invoice/x", "https://www.sandbox.paypal.com/signin"])
    assert.equal(checkoutUrl(url), null);
  assert(checkoutUrl("https://www.sandbox.paypal.com/invoice/p/#x"));
});
test("diagnostics explain known provider failures without leaking raw credentials or descriptions", () => {
  for (const [status, expected] of [[401, "PAYPAL_AUTH_FAILED"], [403, "PAYPAL_PERMISSION_DENIED"], [429, "PAYPAL_RATE_LIMITED"], [500, "PAYPAL_NETWORK_ERROR"]] as const) {
    const error = providerError(status, { message: "secret-test-value", details: [{ description: "secret-test-value" }], debug_id: "debug-123" }, "create_invoice");
    assert.equal(error.diagnostic.code, expected);
    assert.doesNotMatch(JSON.stringify(error), /secret-test-value/);
    for (const key of ["message", "operation", "cause", "recovery", "requestId", "timestamp"] as const) assert(error.diagnostic[key]);
    assert.equal(error.diagnostic.retrySafe, status === 401 || status === 403);
  }
  assert.match(databasePaymentError("load", "PGRST205").diagnostic.recovery, /migration 004/);
  assert.equal(databasePaymentError("save", "XX000").diagnostic.code, "DATABASE_PAYMENT_SYNC_FAILED");
});

function transportFor(reply: (url: string, init: RequestInit) => Promise<Response>) {
  return (async (input, init = {}) => {
    const url = String(input);
    assert(url.startsWith(PAYPAL_BASE + "/"));
    if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "fake-token", expires_in: 3600 });
    return reply(url, init);
  }) as typeof fetch;
}
test("gateway creates once with a stable operation ID and handles minimal invoice links", async () => {
  let posts = 0;
  const g = new PayPalGateway(config, transportFor(async (url, init) => {
    posts++; assert.equal(init.method, "POST"); assert.equal(new Headers(init.headers).get("paypal-request-id"), "stable-operation");
    return Response.json({ href: PAYPAL_BASE + "/v2/invoicing/invoices/" + invoiceId }, { status: 201 });
  }));
  assert.equal(await g.create({}, "stable-operation"), invoiceId); assert.equal(posts, 1);
});
test("invalid credentials, denied permissions, outages and timeouts give actionable errors without automatic mutation retry", async () => {
  const badAuth = new PayPalGateway(config, (async () => Response.json({ error: "invalid_client" }, { status: 401 })) as typeof fetch);
  await assert.rejects(badAuth.authenticate(), code("PAYPAL_AUTH_FAILED"));
  for (const status of [403, 429, 500]) {
    let posts = 0;
    const g = new PayPalGateway(config, transportFor(async () => { posts++; return Response.json({}, { status }); }));
    await assert.rejects(g.create({}, "stable"), PaymentError); assert.equal(posts, 1);
  }
  const timeout = new PayPalGateway(config, transportFor(async () => { throw new DOMException("test", "TimeoutError"); }));
  await assert.rejects(timeout.create({}, "stable"), code("PAYPAL_TIMEOUT"));
});
const signatureHeaders = () => new Headers({ "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/test", "paypal-transmission-id": "test-id", "paypal-transmission-sig": "test-signature", "paypal-transmission-time": "2026-10-29T00:00:00Z" });
test("webhook signature requires explicit PayPal verification success for the configured webhook ID", async () => {
  let calls = 0;
  const g = new PayPalGateway(config, transportFor(async (url, init) => {
    calls++; assert(url.endsWith("/verify-webhook-signature"));
    assert.equal(JSON.parse(String(init.body)).webhook_id, env.PAYPAL_WEBHOOK_ID);
    return Response.json({ verification_status: "FAILURE" });
  }));
  await assert.rejects(g.verifyWebhook(new Headers(), {}), code("PAYPAL_WEBHOOK_INVALID_SIGNATURE"));
  assert.equal(calls, 0);
  await assert.rejects(g.verifyWebhook(signatureHeaders(), {}), code("PAYPAL_WEBHOOK_INVALID_SIGNATURE"));
  assert.equal(calls, 1);
  const valid = new PayPalGateway(config, transportFor(async () => Response.json({ verification_status: "SUCCESS" })));
  await valid.verifyWebhook(signatureHeaders(), {});
});

function workflowFixture() {
  const p = payment();
  let locked = false;
  const calls = { create: 0, send: 0, get: 0, finish: 0, search: 0 };
  let current = invoice();
  const store: PaymentStore = {
    claim: async (_id, _lease, create) => {
      if (locked) throw new PaymentError("PAYMENT_BUSY", "Busy", "claim", "Refresh", 409, true);
      locked = true; const may_create = create && !p.create_attempted_at;
      if (may_create) p.create_attempted_at = "2026-10-29";
      return { payment: structuredClone(p), may_create };
    },
    attach: async (_id, _lease, id) => { p.paypal_invoice_id = id; },
    finish: async (_p, _lease, i) => { calls.finish++; p.status = verifyInvoice(p, i).status; locked = false; },
    fail: async () => { locked = false; },
  };
  const gateway: InvoiceGateway = {
    authenticate: async () => {},
    create: async () => { calls.create++; return invoiceId; },
    get: async () => { calls.get++; return structuredClone(current); },
    search: async () => { calls.search++; return [structuredClone(current)]; },
    send: async () => { calls.send++; current = invoice("UNPAID"); },
  };
  return { p, store, gateway, calls, setInvoice: (i: PayPalInvoice) => { current = i; } };
}
const sendOptions = { createAndSend: true, title: "Work", source: "api" as const };
test("only the configured freelancer can start the merchant invoice path", () => {
  assert.doesNotThrow(()=>assertConfiguredFreelancer(config, config.freelancerId));
  for (const userId of ["client", "outsider", "another-freelancer", ""]) assert.throws(()=>assertConfiguredFreelancer(config, userId), code("PAYMENT_MERCHANT_NOT_CONFIGURED"));
});
test("stale payment eligibility rejected at claim cannot create or send a provider invoice", async () => {
  const f = workflowFixture();
  f.store.claim = async () => {throw new PaymentError("PAYMENT_APPROVAL_REQUIRED", "Stale agreement", "claim", "Review current terms", 409);};
  await assert.rejects(runPayment(f.store, f.gateway, f.p, sendOptions), code("PAYMENT_APPROVAL_REQUIRED"));
  assert.equal(f.calls.create, 0); assert.equal(f.calls.send, 0); assert.equal(f.calls.finish, 0);
});
test("refresh of an unstarted payment cannot create or send an invoice", async () => {
  const f = workflowFixture();
  await assert.rejects(runPayment(f.store, f.gateway, f.p, { ...sendOptions, createAndSend: false, source: "reconcile" }), code("PAYPAL_PAYMENT_NOT_CONFIRMED"));
  assert.equal(f.calls.create, 0); assert.equal(f.calls.send, 0); assert.equal(f.calls.search, 0);
});
test("double-click/concurrent workers create only one provider invoice", async () => {
  const f = workflowFixture();
  const results = await Promise.allSettled([runPayment(f.store, f.gateway, f.p, sendOptions), runPayment(f.store, f.gateway, f.p, sendOptions)]);
  assert.equal(f.calls.create, 1); assert.equal(f.calls.send, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("lost create response recovers by invoice number without issuing a second creation", async () => {
  const f = workflowFixture();
  f.gateway.create = async () => { f.calls.create++; throw new PaymentError("PAYPAL_TIMEOUT", "Timeout", "create", "Refresh", 503); };
  await assert.rejects(runPayment(f.store, f.gateway, f.p, sendOptions));
  await runPayment(f.store, f.gateway, f.p, sendOptions);
  assert.equal(f.calls.create, 1); assert.equal(f.calls.search, 1); assert.equal(f.p.status, "UNPAID");
});
test("missing recovery result blocks replacement invoices and returns a safe refresh action", async () => {
  const f = workflowFixture(); f.p.create_attempted_at = "2026-10-29"; f.gateway.search = async () => [];
  await assert.rejects(runPayment(f.store, f.gateway, f.p, sendOptions), code("PAYPAL_PAYMENT_NOT_CONFIRMED"));
  assert.equal(f.calls.create, 0); assert.equal(f.calls.send, 0);
});
test("database write failure after creation stops sending and retry recovers the existing invoice", async () => {
  const f = workflowFixture(), attach = f.store.attach;
  f.store.attach = async () => { throw databasePaymentError("attach", "XX000"); };
  await assert.rejects(runPayment(f.store, f.gateway, f.p, sendOptions));
  assert.equal(f.calls.send, 0);
  f.store.attach = attach; await runPayment(f.store, f.gateway, f.p, sendOptions);
  assert.equal(f.calls.create, 1); assert.equal(f.p.paypal_invoice_id, invoiceId);
});
test("lost send response refreshes existing provider state rather than making another invoice", async () => {
  const f = workflowFixture();
  f.gateway.send = async () => { f.calls.send++; f.setInvoice(invoice("UNPAID")); throw new PaymentError("PAYPAL_TIMEOUT", "Timeout", "send", "Refresh", 503); };
  await assert.rejects(runPayment(f.store, f.gateway, f.p, sendOptions));
  await runPayment(f.store, f.gateway, f.p, sendOptions);
  assert.equal(f.calls.create, 1); assert.equal(f.calls.send, 1); assert.equal(f.p.status, "UNPAID");
});
test("reconciliation of a pending, paid or cancelled invoice performs no financial POST", async () => {
  for (const status of ["PAYMENT_PENDING", "PAID", "CANCELLED"]) {
    const f = workflowFixture(); f.p.paypal_invoice_id = invoiceId; f.p.create_attempted_at = "2026-10-29"; f.setInvoice(invoice(status));
    await runPayment(f.store, f.gateway, f.p, { ...sendOptions, createAndSend: false, source: "reconcile" });
    assert.equal(f.calls.create, 0); assert.equal(f.calls.send, 0); assert.equal(f.p.status, status);
  }
});
test("a paid invoice is never sent or created again on a repeated create request", async () => {
  const f = workflowFixture(); f.p.paypal_invoice_id = invoiceId; f.p.create_attempted_at = "done"; f.setInvoice(invoice("PAID"));
  await runPayment(f.store, f.gateway, f.p, sendOptions);
  assert.equal(f.calls.create, 0); assert.equal(f.calls.send, 0); assert.equal(f.p.status, "PAID");
});

const event = { id: "WH-test", event_type: "INVOICING.INVOICE.PAID", resource: { id: invoiceId, status: "PAID" } };
function webhookFixture() {
  let state: "RECEIVED" | "FAILED" | "PROCESSED" | "IGNORED" = "RECEIVED";
  const calls = { record: 0, reconcile: 0, complete: 0 };
  const work: WebhookWork = { verify: async () => {}, record: async () => { calls.record++; return state; },
    reconcile: async () => { calls.reconcile++; }, complete: async (_id, next) => { calls.complete++; state = next; }, fail: async () => { state = "FAILED"; } };
  return { work, calls, state: () => state };
}
test("unverified webhook never reaches durable storage or financial reconciliation", async () => {
  const f = webhookFixture(); f.work.verify = async () => { throw new PaymentError("PAYPAL_WEBHOOK_INVALID_SIGNATURE", "Invalid", "verify", "Check signature", 400); };
  await assert.rejects(processWebhook(f.work, signatureHeaders(), event));
  assert.equal(f.calls.record, 0); assert.equal(f.calls.reconcile, 0);
});
test("duplicate verified webhook is durably recognized and processed once", async () => {
  const f = webhookFixture(); await processWebhook(f.work, signatureHeaders(), event); await processWebhook(f.work, signatureHeaders(), event);
  assert.equal(f.calls.reconcile, 1); assert.equal(f.state(), "PROCESSED");
});
test("recording failure prevents acknowledgment and reconciliation", async () => {
  const f = webhookFixture(); f.work.record = async () => { throw databasePaymentError("record"); };
  await assert.rejects(processWebhook(f.work, signatureHeaders(), event)); assert.equal(f.calls.reconcile, 0); assert.equal(f.calls.complete, 0);
});
test("processing/completion failure remains retryable instead of being marked processed", async () => {
  const f = webhookFixture(); f.work.reconcile = async () => { throw Error("Provider down"); };
  await assert.rejects(processWebhook(f.work, signatureHeaders(), event)); assert.equal(f.state(), "FAILED");
  f.work.reconcile = async () => { f.calls.reconcile++; };
  await processWebhook(f.work, signatureHeaders(), event); assert.equal(f.state(), "PROCESSED");
});
test("out-of-order event payload status is ignored in favor of provider reconciliation", async () => {
  const f = webhookFixture();
  await processWebhook(f.work, signatureHeaders(), { ...event, event_type: "INVOICING.INVOICE.SENT", resource: { id: invoiceId, status: "UNPAID" } });
  assert.equal(f.calls.reconcile, 1);
  assert.equal(webhookIdentity({ ...event, resource: { invoice: { id: invoiceId } } }).invoiceId, invoiceId);
  assert.throws(() => webhookIdentity({ ...event, resource: { id: "unrelated" } }), PaymentError);
});
