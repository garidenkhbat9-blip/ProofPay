import { createHash } from "node:crypto";
import { ApiError, readJsonBounded } from "@/lib/api-http";
import { assertMerchant, paymentServices, paymentStore, paymentResponseError } from "@/lib/server/payments";
import { PaymentError, databasePaymentError } from "@/lib/payments/errors";
import { processWebhook } from "@/lib/payments/webhook";
import { runPayment } from "@/lib/payments/workflow";
import type { Payment } from "@/lib/payments/model";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const event = await readJsonBounded(request, 256 * 1024);
    const services = paymentServices();
    let attempts = 0;
    await processWebhook({
      verify: (headers, event) => services.gateway.verifyWebhook(headers, event),
      record: async (identity, event) => {
        const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
        const inserted = await services.admin.from("paypal_webhook_events").upsert({
          event_id: identity.eventId, event_type: identity.eventType, invoice_id: identity.invoiceId,
          payload_sha256: hash, verified_event: identity,
        }, { onConflict: "event_id", ignoreDuplicates: true });
        if (inserted.error) throw databasePaymentError("record_webhook", inserted.error.code);
        const saved = await services.admin.from("paypal_webhook_events").select("state,payload_sha256,attempts").eq("event_id", identity.eventId).single();
        if (saved.error) throw databasePaymentError("read_webhook", saved.error.code);
        if (saved.data.payload_sha256 !== hash) throw new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED", "An event identifier was reused with different content.", "process_webhook", "Ask support to inspect the verified event conflict.", 409);
        attempts = saved.data.attempts + 1;
        return saved.data.state;
      },
      reconcile: async (invoiceId) => {
        const payment = await services.admin.from("payments").select("*").eq("paypal_invoice_id", invoiceId).maybeSingle();
        if (payment.error) throw databasePaymentError("find_webhook_payment", payment.error.code);
        if (!payment.data) throw new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED", "The invoice has not been linked to a ProofPay payment.", "process_webhook", "Retry delivery after invoice recovery. Unrelated invoices must never update a milestone.", 503, true);
        await assertMerchant(services, payment.data as Payment);
        await runPayment(paymentStore(services.admin), services.gateway, payment.data as Payment,
          { createAndSend: false, title: "Approved ProofPay milestone", source: "webhook" });
      },
      complete: async (eventId, state) => {
        const done = await services.admin.from("paypal_webhook_events").update({ state, processed_at: new Date().toISOString(), last_error: null, attempts }).eq("event_id", eventId);
        if (done.error) throw databasePaymentError("complete_webhook", done.error.code);
      },
      fail: async (eventId, issue) => {
        const failed = await services.admin.from("paypal_webhook_events").update({ state: "FAILED", last_error: issue.diagnostic, attempts }).eq("event_id", eventId).neq("state", "PROCESSED");
        if (failed.error) throw databasePaymentError("record_webhook_failure", failed.error.code);
      },
    }, request.headers, event);
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError) return paymentResponseError(new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED",
      "The webhook payload could not be read.", "read_webhook", "Send the original PayPal JSON event body, within the 256 KB request limit.", error.status, false,
      error.status === 413 ? "The event exceeded the request size limit." : "The request did not contain a valid JSON body."), "webhook");
    return paymentResponseError(error, "webhook");
  }
}
