import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { paymentConfig } from "../payments/config";
import { PaymentError, databasePaymentError } from "../payments/errors";
import { PayPalGateway } from "../payments/gateway";
import { verifyInvoice, type Payment } from "../payments/model";
import type { PaymentStore } from "../payments/workflow";
import { ApiError } from "../api-http";

export const paymentColumns = "id,project_id,milestone_id,agreement_id,submission_id,freelancer_id,payer_id,amount,currency,invoice_number,paypal_invoice_id,status,provider_status,checkout_url,create_retry_allowed,last_verified_at,paid_at,cancelled_at,refunded_at,reconciliation_status,last_error,created_at,updated_at";
let gateway: PayPalGateway | null = null;
let gatewayKey = "";
export function paymentServices() {
  const config = paymentConfig(process.env);
  const fingerprint = createHash("sha256").update(config.clientId).digest("hex");
  const key = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (!gateway || gatewayKey !== key) { gateway = new PayPalGateway(config); gatewayKey = key; }
  return { config, fingerprint, gateway, admin: paymentAdmin() };
}
export function paymentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new PaymentError("PAYPAL_CONFIG_MISSING", "Server payment storage access is not configured.", "configuration", "Ask the administrator to configure SUPABASE_SECRET_KEY on the server only.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) } });
}
export async function paymentRpc<T>(admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    const known: Record<string, [string, string, number, boolean]> = {
      PAYMENT_UNAUTHORIZED: ["You are not authorized to create this invoice.", "Sign in as the assigned freelancer.", 403, false],
      PAYMENT_APPROVAL_REQUIRED: ["This milestone is not eligible for payment.", "Both parties must accept the latest agreement and the client must approve the latest evidence.", 409, false],
      PAYMENT_MERCHANT_NOT_CONFIGURED: ["The freelancer's merchant ownership has not been configured.", "Ask the administrator to verify and enable the freelancer's Sandbox merchant binding.", 503, false],
      PAYPAL_INVALID_RECIPIENT: ["The project client's invoice email is invalid or unverified.", "Verify the client's email and use separate buyer and merchant accounts.", 422, false],
      PAYPAL_INVALID_AMOUNT: ["This milestone has no payable amount.", "A zero-value milestone does not require an invoice.", 422, false],
      PAYPAL_CURRENCY_UNSUPPORTED: ["Only USD milestones are supported.", "Ask support to review the accepted currency.", 422, false],
      PAYMENT_BUSY: ["A payment check is running or was just completed.", "Wait a few seconds and refresh. An interrupted operation may need up to three minutes to expire.", 409, true],
      PAYMENT_STALE_SNAPSHOT: ["PayPal returned an older invoice snapshot.", "Wait a moment and refresh. Previously verified payment information is retained.", 409, true],
      PAYMENT_LEASE_LOST: ["The payment check expired before it could be saved.", "Refresh payment status; no new invoice will be created by refresh.", 409, true],
    };
    const entry = known[error.message];
    if (entry) throw new PaymentError(error.message, entry[0], name, entry[1], entry[2], entry[3], "The database rejected the operation.");
    throw databasePaymentError(name, error.code);
  }
  return data as T;
}
export function paymentStore(admin: SupabaseClient): PaymentStore {
  return {
    claim: (id, lease, create) => paymentRpc(admin, "claim_paypal_payment", { p_id: id, p_lease: lease, p_create: create }),
    attach: (id, lease, invoiceId) => paymentRpc(admin, "attach_paypal_invoice", { p_id: id, p_lease: lease, p_invoice: invoiceId }),
    finish: async (payment, lease, invoice, source) => {
      const result = verifyInvoice(payment, invoice);
      await paymentRpc(admin, "finish_paypal_payment", { p_id: payment.id, p_lease: lease, p_status: result.status,
        p_provider_status: result.providerStatus, p_url: result.checkoutUrl,
        p_snapshot: { id: invoice.id, status: invoice.status, amount: invoice.amount, due_amount: invoice.due_amount,
          updated_at: invoice.detail?.metadata?.last_update_time && Number.isFinite(Date.parse(invoice.detail.metadata.last_update_time)) ? invoice.detail.metadata.last_update_time : null,
          detail: { invoice_number: invoice.detail?.invoice_number, reference: invoice.detail?.reference, currency_code: invoice.detail?.currency_code },
          payments: invoice.payments?.transactions?.map((t) => ({ type: t.type, payment_id: t.payment_id, amount: t.amount })),
          refunds: invoice.refunds?.transactions?.map((t) => ({ type: t.type, refund_id: t.refund_id, amount: t.amount })) }, p_source: source });
    },
    fail: (id, lease, error) => paymentRpc(admin, "fail_paypal_payment", { p_id: id, p_lease: lease, p_error: error.diagnostic }),
  };
}
export async function assertMerchant(services: ReturnType<typeof paymentServices>, p?: Payment) {
  const { config, fingerprint, admin } = services;
  const { data, error } = await admin.from("paypal_merchant_bindings").select("id")
    .eq("freelancer_id", config.freelancerId).eq("merchant_id", config.merchantId).eq("merchant_email", config.merchantEmail)
    .eq("credential_fingerprint", fingerprint).eq("active", true).not("verified_at", "is", null).maybeSingle();
  if (error) throw databasePaymentError("validate_merchant", error.code);
  if (!data || (p && (p.freelancer_id !== config.freelancerId || p.merchant_id !== config.merchantId || p.merchant_email !== config.merchantEmail || p.credential_fingerprint !== fingerprint)))
    throw new PaymentError("PAYMENT_MERCHANT_NOT_CONFIGURED", "This freelancer is not linked to the configured Sandbox merchant.", "validate_merchant", "Ask the administrator to verify merchant ownership. A shared platform merchant cannot pay arbitrary freelancers.", 503, false);
}
export function paymentResponseError(error: unknown, operation: string) {
  const issue = error instanceof PaymentError ? error : error instanceof ApiError ? new PaymentError(
    error.status === 401 || error.status === 403 || error.status === 404 ? "PAYMENT_UNAUTHORIZED" : "PAYPAL_PAYMENT_NOT_CONFIRMED",
    error.status < 500 ? error.message : "Payment access could not be checked.", operation,
    error.status === 401 ? "Sign in again and refresh payment status." : "Check your project membership or contact support with the reference ID.", error.status, error.status >= 500)
    : new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED", "The payment operation could not be confirmed.", operation, "Refresh payment status and contact support with the reference ID if this persists.", 500, true);
  console.error("proofpay-payment", issue.diagnostic);
  return Response.json({ error: issue.diagnostic }, { status: issue.status, headers: { "Cache-Control": "no-store", ...(issue.status === 429 ? { "Retry-After": "60" } : {}) } });
}
export async function authenticatedPayments(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Use the application to make this request.");
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new ApiError(401, "Sign in to view payments.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiError(503, "Authentication is unavailable.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError(error && (error.status || 0) >= 500 ? 503 : 401, "Your session could not be verified. Sign in again.");
  if (!data.user.email_confirmed_at) throw new ApiError(403, "Verify your email before using payments.");
  return { client, user: data.user };
}
