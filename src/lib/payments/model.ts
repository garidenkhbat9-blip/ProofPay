import { PaymentError } from "./errors";
import { validEmail } from "./config";
export type PaymentStatus = "NOT_STARTED" | "CREATING" | "DRAFT" | "UNPAID" | "PAYMENT_PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "REQUIRES_ATTENTION";
export interface Payment {
  id: string; project_id: string; milestone_id: string; agreement_id: string; submission_id: string;
  freelancer_id: string; payer_id: string; payer_email: string; merchant_id: string; merchant_email: string;
  credential_fingerprint: string; amount: string | number; currency: string; invoice_number: string;
  operation_id: string; paypal_invoice_id: string | null; status: PaymentStatus;
  provider_status: string | null; create_attempted_at: string | null; checkout_url: string | null;
  create_retry_allowed?: boolean;
  last_verified_at: string | null; paid_at: string | null; created_at: string;
  refunded_at?: string | null;
  reconciliation_status: string; last_error: import("./errors").PaymentDiagnostic | null;
}
export const paymentLabels: Record<PaymentStatus, string> = {
  NOT_STARTED: "Approved · invoice not created", CREATING: "Creating Invoice", DRAFT: "Draft invoice · not sent",
  UNPAID: "Awaiting Payment", PAYMENT_PENDING: "Payment Pending", PAID: "Paid — Confirmed by PayPal",
  FAILED: "Payment Failed", CANCELLED: "Payment Cancelled", REFUNDED: "Refunded — Confirmed by PayPal", REQUIRES_ATTENTION: "Action Required",
};
export function cents(value: unknown): number {
  const s = String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) throw new PaymentError("PAYPAL_INVALID_AMOUNT", "The payment amount is invalid.", "validate_invoice", "Ask support to check the accepted milestone amount.", 422);
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function invoiceBody(p: Payment, title: string) {
  if (p.currency !== "USD") throw new PaymentError("PAYPAL_CURRENCY_UNSUPPORTED", "This deployment supports USD milestones only.", "create_invoice", "Use a supported, mutually accepted agreement. Do not override the saved currency.", 422);
  if (cents(p.amount) <= 0) throw new PaymentError("PAYPAL_INVALID_AMOUNT", "A payable milestone must have a positive amount.", "create_invoice", "Zero-value milestones do not require a PayPal invoice.", 422);
  if (!validEmail(p.payer_email) || p.payer_email.toLowerCase() === p.merchant_email.toLowerCase())
    throw new PaymentError("PAYPAL_INVALID_RECIPIENT", "The invoice recipient is invalid or is the merchant.", "create_invoice", "Verify the project client's email and use separate Sandbox buyer and merchant accounts.", 422);
  return {
    detail: { invoice_number: p.invoice_number, reference: p.operation_id, currency_code: p.currency,
      payment_term: { term_type: "DUE_ON_RECEIPT" } },
    invoicer: { email_address: p.merchant_email },
    primary_recipients: [{ billing_info: { email_address: p.payer_email } }],
    items: [{ name: title.slice(0, 120), quantity: "1", unit_amount: { currency_code: p.currency, value: (cents(p.amount) / 100).toFixed(2) } }],
    configuration: { partial_payment: { allow_partial_payment: false }, allow_tip: false },
  };
}
type Money = { currency_code?: string; value?: string };
type Transaction = { type?: string; payment_id?: string; refund_id?: string; amount?: Money };
export interface PayPalInvoice {
  id?: string; status?: string; amount?: Money; due_amount?: Money;
  detail?: { invoice_number?: string; reference?: string; currency_code?: string; metadata?: { recipient_view_url?: string; last_update_time?: string } };
  invoicer?: { email_address?: string };
  primary_recipients?: { billing_info?: { email_address?: string } }[];
  payments?: { paid_amount?: Money; transactions?: Transaction[] };
  refunds?: { refund_amount?: Money; transactions?: Transaction[] };
}
export function checkoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "www.sandbox.paypal.com" && !u.port && !u.username && !u.password && u.pathname.startsWith("/invoice/") ? u.href : null; } catch { return null; }
}
function providerTotal(rows: Transaction[] | undefined, currency: string, refund = false) {
  const seen = new Set<string>();
  if (!rows?.length) return -1;
  let total = 0;
  for (const t of rows) {
    const id = refund ? t.refund_id : t.payment_id;
    if (t.type !== "PAYPAL" || !id || seen.has(id) || t.amount?.currency_code !== currency) return -1;
    seen.add(id); total += cents(t.amount.value);
  }
  return total;
}
export function verifyInvoice(p: Payment, invoice: PayPalInvoice) {
  const fail = () => { throw new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED", "PayPal invoice details do not match this approved milestone.", "reconcile_invoice", "Do not pay this invoice. Ask support to review the merchant, recipient and agreed amount.", 409, false, "Invoice identity or financial details do not match the immutable payment snapshot."); };
  if (!invoice.id || (p.paypal_invoice_id && invoice.id !== p.paypal_invoice_id) ||
    invoice.detail?.invoice_number !== p.invoice_number || invoice.detail.reference !== p.operation_id ||
    invoice.invoicer?.email_address?.toLowerCase() !== p.merchant_email.toLowerCase() ||
    invoice.primary_recipients?.length !== 1 || invoice.primary_recipients[0].billing_info?.email_address?.toLowerCase() !== p.payer_email.toLowerCase() ||
    invoice.amount?.currency_code !== p.currency || invoice.detail.currency_code !== p.currency ||
    cents(invoice.amount?.value) !== cents(p.amount)) fail();
  const raw = invoice.status || "UNKNOWN";
  let status: PaymentStatus;
  switch (raw) {
    case "DRAFT": status = "DRAFT"; break;
    case "SENT": case "UNPAID": case "SHARED": status = "UNPAID"; break;
    case "SCHEDULED": case "PAYMENT_PENDING": case "PARTIALLY_PAID": status = "PAYMENT_PENDING"; break;
    case "CANCELLED": case "AUTO_CANCELLED": status = "CANCELLED"; break;
    case "PAID":
      status = invoice.due_amount?.currency_code === p.currency && cents(invoice.due_amount.value) === 0 &&
        providerTotal(invoice.payments?.transactions, p.currency) === cents(p.amount) && !invoice.refunds?.transactions?.length &&
        (!invoice.payments?.paid_amount || (invoice.payments.paid_amount.currency_code === p.currency && cents(invoice.payments.paid_amount.value) === cents(p.amount))) &&
        (!invoice.refunds?.refund_amount || (invoice.refunds.refund_amount.currency_code === p.currency && cents(invoice.refunds.refund_amount.value) === 0)) ? "PAID" : "REQUIRES_ATTENTION";
      break;
    case "REFUNDED":
      status = providerTotal(invoice.refunds?.transactions, p.currency, true) === cents(p.amount) &&
        (!invoice.refunds?.refund_amount || (invoice.refunds.refund_amount.currency_code === p.currency && cents(invoice.refunds.refund_amount.value) === cents(p.amount))) ? "REFUNDED" : "REQUIRES_ATTENTION";
      break;
    default: status = "REQUIRES_ATTENTION";
  }
  if (status === "UNPAID" && (invoice.payments?.transactions?.length ||
    (invoice.due_amount && (invoice.due_amount.currency_code !== p.currency || cents(invoice.due_amount.value) !== cents(p.amount))))) status = "REQUIRES_ATTENTION";
  if (((p.paid_at || p.status === "PAID") && !["PAID", "REFUNDED", "REQUIRES_ATTENTION"].includes(status)) ||
      ((p.refunded_at || p.status === "REFUNDED") && status !== "REFUNDED")) status = "REQUIRES_ATTENTION";
  return { status, providerStatus: raw, checkoutUrl: status === "UNPAID" ? checkoutUrl(invoice.detail?.metadata?.recipient_view_url) : null };
}
