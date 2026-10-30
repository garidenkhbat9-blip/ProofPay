import { PaymentError } from "./errors";
export const invoiceEvents = new Set(["INVOICING.INVOICE.CREATED", "INVOICING.INVOICE.SENT", "INVOICING.INVOICE.PAID", "INVOICING.INVOICE.CANCELLED", "INVOICING.INVOICE.REFUNDED", "INVOICING.INVOICE.UPDATED", "INVOICING.INVOICE.SCHEDULED"]);
export function webhookIdentity(input: unknown) {
  const e = input as { id?: unknown; event_type?: unknown; resource?: { id?: unknown; invoice?: { id?: unknown } } } | null;
  if (!e || typeof e.id !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(e.id) || typeof e.event_type !== "string" || e.event_type.length > 100)
    throw new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED", "The verified webhook has an invalid envelope.", "process_webhook", "Inspect and resend the event from the PayPal Sandbox webhook dashboard.", 400);
  const candidate = e.resource?.invoice?.id ?? e.resource?.id;
  const invoiceId = typeof candidate === "string" && /^INV2-[A-Z0-9-]{10,30}$/.test(candidate) ? candidate : null;
  if (invoiceEvents.has(e.event_type) && !invoiceId) throw new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED", "The verified invoice event has no usable invoice identity.", "process_webhook", "Inspect the Sandbox event payload and resend after correcting the integration.", 400);
  return { eventId: e.id, eventType: e.event_type, invoiceId };
}
export interface WebhookWork {
  verify(headers: Headers, event: unknown): Promise<void>;
  record(identity: ReturnType<typeof webhookIdentity>, event: unknown): Promise<"RECEIVED" | "FAILED" | "PROCESSED" | "IGNORED">;
  reconcile(invoiceId: string): Promise<void>;
  complete(eventId: string, state: "PROCESSED" | "IGNORED"): Promise<void>;
  fail(eventId: string, error: PaymentError): Promise<void>;
}
export async function processWebhook(work: WebhookWork, headers: Headers, event: unknown) {
  await work.verify(headers, event);
  const identity = webhookIdentity(event);
  const previous = await work.record(identity, event);
  if (previous === "PROCESSED" || previous === "IGNORED") return;
  try {
    const relevant = invoiceEvents.has(identity.eventType);
    if (relevant) await work.reconcile(identity.invoiceId!);
    await work.complete(identity.eventId, relevant ? "PROCESSED" : "IGNORED");
  } catch (error) {
    const issue = error instanceof PaymentError ? error : new PaymentError("PAYPAL_WEBHOOK_PROCESSING_FAILED", "The verified event could not be processed.", "process_webhook", "Retry delivery from PayPal after restoring the service.", 503, true);
    await work.fail(identity.eventId, issue);
    throw issue;
  }
}
