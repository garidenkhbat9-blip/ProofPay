import { PaymentError } from "./errors";
import { invoiceBody, verifyInvoice, type Payment, type PayPalInvoice } from "./model";
export interface InvoiceGateway {
  authenticate(): Promise<void>;
  create(body: unknown, operationId: string): Promise<string>;
  get(id: string): Promise<PayPalInvoice>;
  search(number: string): Promise<PayPalInvoice[]>;
  send(id: string, operationId: string): Promise<void>;
}
export interface PaymentStore {
  claim(id: string, lease: string, create: boolean): Promise<{ payment: Payment; may_create: boolean }>;
  attach(id: string, lease: string, invoiceId: string): Promise<void>;
  finish(payment: Payment, lease: string, invoice: PayPalInvoice, source: "api" | "webhook" | "reconcile"): Promise<void>;
  fail(id: string, lease: string, error: PaymentError): Promise<void>;
}
export async function runPayment(store: PaymentStore, gateway: InvoiceGateway, original: Payment,
  options: { createAndSend: boolean; title: string; source: "api" | "webhook" | "reconcile" }) {
  // Validate and authenticate before consuming the one allowed creation attempt.
  const body = invoiceBody(original, options.title);
  await gateway.authenticate();
  const lease = crypto.randomUUID();
  const { payment: p, may_create } = await store.claim(original.id, lease, options.createAndSend);
  try {
    let id = p.paypal_invoice_id;
    if (!id && may_create && options.createAndSend) {
      id = await gateway.create(body, p.operation_id);
      await store.attach(p.id, lease, id);
    } else if (!id && p.create_attempted_at) {
      const matches = await gateway.search(p.invoice_number);
      if (matches.length !== 1 || !matches[0].id) throw new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED",
        "The previous invoice creation result is still uncertain.", "recover_invoice",
        "Refresh again later. If no invoice appears, ask the merchant to search the Sandbox dashboard using the invoice number. Do not create a replacement.", 409, true,
        matches.length > 1 ? "More than one matching invoice was returned." : "No matching invoice is visible yet.");
      id = matches[0].id;
      const candidate = await gateway.get(id);
      verifyInvoice(p, candidate);
      await store.attach(p.id, lease, id);
    }
    if (!id) throw new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED", "No invoice has been created.", "reconcile_invoice", "The assigned freelancer must create the invoice after approval.", 409, false);
    p.paypal_invoice_id = id;
    let invoice = await gateway.get(id);
    const verified = verifyInvoice(p, invoice);
    if (options.createAndSend && verified.status === "DRAFT") {
      await gateway.send(id, p.operation_id);
      invoice = await gateway.get(id);
      verifyInvoice(p, invoice);
    }
    await store.finish(p, lease, invoice, options.source);
    return verifyInvoice(p, invoice);
  } catch (error) {
    const issue = error instanceof PaymentError ? error : new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED",
      "The payment operation could not be confirmed.", options.source, "Refresh payment status before any further action.", 503, true);
    try { await store.fail(p.id, lease, issue); }
    catch { throw new PaymentError("DATABASE_PAYMENT_SYNC_FAILED", "The operation failed and its diagnostic could not be saved.", options.source,
      "Refresh payment status after the service recovers. Contact support with this reference; do not create another invoice.", 503, true,
      `Original diagnostic: ${issue.diagnostic.code}; reference: ${issue.diagnostic.requestId}.`); }
    throw issue;
  }
}
