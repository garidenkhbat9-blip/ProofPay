export interface PaymentDiagnostic {
  code: string;
  message: string;
  operation: string;
  cause: string;
  recovery: string;
  retrySafe: boolean;
  requestId: string;
  timestamp: string;
  providerDebugId?: string;
}

export class PaymentError extends Error {
  readonly diagnostic: PaymentDiagnostic;
  constructor(code: string, message: string, operation: string, recovery: string,
    public readonly status = 409, retrySafe = false, cause = "Unknown", providerDebugId?: string) {
    super(message);
    this.diagnostic = { code, message, operation, cause, recovery, retrySafe,
      requestId: crypto.randomUUID(), timestamp: new Date().toISOString(),
      ...(providerDebugId && /^[a-zA-Z0-9-]{1,100}$/.test(providerDebugId) ? { providerDebugId } : {}) };
  }
}

export function databasePaymentError(operation: string, code?: string) {
  const missing = ["42P01", "42883", "PGRST202", "PGRST205"].includes(code || "");
  return new PaymentError("DATABASE_PAYMENT_SYNC_FAILED",
    missing ? "Payment storage is not installed on this deployment." : "Payment information could not be saved or loaded.", operation,
    missing ? "Ask the administrator to deploy migration 004 once, then reload the schema cache." : "Refresh payment status before trying another action. Contact support with the reference ID if this persists.",
    503, true, missing ? "Required payment table or function is missing." : "The database request failed; its outcome may be uncertain.");
}

export function providerError(status: number, body: unknown, operation: string): PaymentError {
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const details = Array.isArray(data.details) ? data.details : [];
  const issues = details.map((d) => d && typeof d === "object" && "issue" in d ? String(d.issue) : "");
  const debug = typeof data.debug_id === "string" ? data.debug_id : undefined;
  let code = operation === "send_invoice" ? "PAYPAL_INVOICE_SEND_FAILED" : operation === "create_invoice" ? "PAYPAL_INVOICE_CREATION_FAILED" : "PAYPAL_PAYMENT_NOT_CONFIRMED";
  let message = "PayPal did not complete the requested operation.";
  let recovery = "Refresh payment status before trying again. Contact support with the reference ID if the problem persists.";
  let cause = "PayPal rejected the request; the precise cause is not established.";
  if (status === 401 || data.error === "invalid_client") {
    code = "PAYPAL_AUTH_FAILED"; message = "PayPal authentication failed.";
    recovery = "Ask the administrator to verify the Sandbox REST app credentials."; cause = "PayPal rejected authentication.";
  } else if (status === 403) {
    code = "PAYPAL_PERMISSION_DENIED"; message = "This merchant is not permitted to perform this PayPal operation.";
    recovery = "Ask the merchant to check Sandbox Business account status and Invoicing API permissions."; cause = "PayPal denied access.";
  } else if (status === 429) {
    code = "PAYPAL_RATE_LIMITED"; message = "PayPal is temporarily limiting requests.";
    recovery = "Wait at least 60 seconds, then refresh payment status."; cause = "PayPal returned HTTP 429.";
  } else if (issues.some((x) => /CURRENCY/.test(x))) {
    code = "PAYPAL_CURRENCY_UNSUPPORTED"; message = "PayPal did not accept the invoice currency.";
    recovery = "Ask the merchant to verify supported currencies. Do not change the accepted agreement amount.";
  } else if (issues.some((x) => /AMOUNT/.test(x))) {
    code = "PAYPAL_INVALID_AMOUNT"; message = "PayPal did not accept the invoice amount.";
    recovery = "Ask support to compare the accepted milestone and invoice. Do not retry with a different amount.";
  } else if (issues.some((x) => /EMAIL|RECIPIENT/.test(x))) {
    code = "PAYPAL_INVALID_RECIPIENT"; message = "PayPal did not accept the invoice recipient.";
    recovery = "The project client must verify their account email. Ask support to review the saved invoice recipient.";
  } else if (status >= 500) {
    code = "PAYPAL_NETWORK_ERROR"; message = "PayPal is temporarily unavailable.";
    cause = "PayPal returned a server error.";
  }
  return new PaymentError(code, message, operation, recovery, status === 429 ? 429 : 502,
    operation !== "create_invoice" || status === 401 || status === 403, cause, debug);
}
