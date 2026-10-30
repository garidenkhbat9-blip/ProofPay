import { readJsonBounded } from "../api-http";
import { PAYPAL_BASE, type PayPalConfig } from "./config";
import { PaymentError, providerError } from "./errors";
import type { PayPalInvoice } from "./model";

/** Constructed only by the server. Injected transport keeps failure tests offline. */
export class PayPalGateway {
  private token: { value: string; expires: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  constructor(private config: PayPalConfig, private transport: typeof fetch = fetch) {}
  async authenticate() { await this.accessToken(); }
  private async request(path: string, operation: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.transport(PAYPAL_BASE + path, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
    } catch (error) {
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new PaymentError(timeout ? "PAYPAL_TIMEOUT" : "PAYPAL_NETWORK_ERROR",
        timeout ? "PayPal did not respond in time." : "PayPal could not be reached.", operation,
        "Refresh payment status. Do not create another invoice while the previous result is uncertain.", 503, operation !== "create_invoice",
        timeout ? "The provider request exceeded its time limit." : "A network request failed; the provider outcome is unknown.");
    }
    let body: unknown = null;
    if (response.status !== 204) {
      try { body = await readJsonBounded(response, 1024 * 1024); }
      catch {
        if (!response.ok) throw providerError(response.status, null, operation);
        throw new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED", "PayPal returned an unreadable response.", operation, "Refresh payment status before any further action.", 502, operation !== "create_invoice");
      }
    }
    if (!response.ok) throw providerError(response.status, body, operation);
    return body;
  }
  private accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return Promise.resolve(this.token.value);
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const data = await this.request("/v1/oauth2/token", "authenticate_paypal", {
        method: "POST", headers: { Authorization: "Basic " + btoa(this.config.clientId + ":" + this.config.clientSecret), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials",
      }) as { access_token?: string; expires_in?: number };
      if (!data?.access_token || !Number.isFinite(data.expires_in)) throw new PaymentError("PAYPAL_AUTH_FAILED", "PayPal did not issue a usable access token.", "authenticate_paypal", "Ask the administrator to verify the Sandbox credentials.", 502);
      this.token = { value: data.access_token, expires: Date.now() + Math.max(0, data.expires_in! - 60) * 1000 };
      return this.token.value;
    })().finally(() => { this.tokenRequest = null; });
    return this.tokenRequest;
  }
  private async api(path: string, operation: string, method = "GET", body?: unknown, requestId?: string) {
    const token = await this.accessToken();
    try { return await this.request(path, operation, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(requestId ? { "PayPal-Request-Id": requestId } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }); } catch (error) { if (error instanceof PaymentError && error.diagnostic.code === "PAYPAL_AUTH_FAILED") this.token = null; throw error; }
  }
  async create(body: unknown, operationId: string): Promise<string> {
    // DB attempt marker + recovery-by-number are authoritative. We do NOT
    // assume this endpoint retains/deduplicates PayPal-Request-Id indefinitely.
    const result = await this.api("/v2/invoicing/invoices", "create_invoice", "POST", body, operationId) as { id?: string; href?: string; links?: { rel: string; href: string }[] };
    let id = result?.id;
    const href = result?.href || result?.links?.find((l) => l.rel === "self")?.href;
    if (!id && href) { try { const u = new URL(href); if (u.origin === PAYPAL_BASE) id = u.pathname.split("/").pop(); } catch {} }
    if (!id || !/^INV2-[A-Z0-9-]{10,30}$/.test(id)) throw new PaymentError("PAYPAL_INVOICE_CREATION_FAILED", "PayPal did not return an identifiable invoice.", "create_invoice", "Refresh to recover the existing invoice by its unique number. Do not create another invoice.", 502);
    return id;
  }
  get(id: string) { return this.api(`/v2/invoicing/invoices/${encodeURIComponent(id)}`, "reconcile_invoice") as Promise<PayPalInvoice>; }
  async send(id: string, operationId: string) {
    await this.api(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, "send_invoice", "POST", { send_to_invoicer: true, send_to_recipient: true }, operationId + "-send");
  }
  async search(number: string): Promise<PayPalInvoice[]> {
    const result = await this.api("/v2/invoicing/search-invoices?page=1&page_size=100&total_required=true", "recover_invoice", "POST", { invoice_number: number }) as { items?: PayPalInvoice[]; total_items?: number };
    if (!Array.isArray(result?.items) || (result.total_items ?? 0) > 100) throw new PaymentError("PAYPAL_PAYMENT_NOT_CONFIRMED", "The invoice search could not be verified.", "recover_invoice", "Ask the merchant to locate the invoice in the Sandbox dashboard.", 502, true);
    return result.items.filter((i) => i.detail?.invoice_number === number);
  }
  async verifyWebhook(headers: Headers, event: unknown) {
    const fields = { auth_algo: "paypal-auth-algo", cert_url: "paypal-cert-url", transmission_id: "paypal-transmission-id", transmission_sig: "paypal-transmission-sig", transmission_time: "paypal-transmission-time" };
    const body: Record<string, unknown> = { webhook_id: this.config.webhookId, webhook_event: event };
    for (const [key, header] of Object.entries(fields)) {
      const value = headers.get(header);
      if (!value || value.length > 4096) throw invalidWebhook();
      body[key] = value;
    }
    // No arbitrary certificate URL is fetched by this application.
    let cert: URL;
    try { cert = new URL(String(body.cert_url)); } catch { throw invalidWebhook(); }
    if (cert.protocol !== "https:" || !["api.paypal.com", "api.sandbox.paypal.com", "api-m.sandbox.paypal.com"].includes(cert.hostname) || cert.port || cert.username || cert.password || !cert.pathname.startsWith("/v1/notifications/certs/")) throw invalidWebhook();
    const result = await this.api("/v1/notifications/verify-webhook-signature", "verify_webhook", "POST", body) as { verification_status?: string };
    if (result?.verification_status !== "SUCCESS") throw invalidWebhook();
  }
}
export function invalidWebhook() { return new PaymentError("PAYPAL_WEBHOOK_INVALID_SIGNATURE", "The webhook could not be authenticated.", "verify_webhook", "Verify the registered Sandbox webhook ID and request signature headers.", 400, false); }
