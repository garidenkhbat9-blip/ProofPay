import { PaymentError } from "./errors";

export interface PayPalConfig {
  clientId: string; clientSecret: string; webhookId: string;
  merchantId: string; merchantEmail: string; freelancerId: string;
}
export const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";
export function paymentConfig(env: Record<string, string | undefined>): PayPalConfig {
  if (env.PAYPAL_ENV !== "sandbox") throw new PaymentError("PAYPAL_CONFIG_MISSING",
    "Sandbox payments are not enabled.", "configuration", "Set PAYPAL_ENV=sandbox on the server. Live payments are disabled.", 503, false,
    "PAYPAL_ENV is missing or is not sandbox.");
  const required = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_MERCHANT_ID", "PAYPAL_MERCHANT_EMAIL", "PAYPAL_FREELANCER_USER_ID"] as const;
  for (const name of required) if (!env[name]?.trim()) throw new PaymentError(
    name.includes("MERCHANT") || name.includes("FREELANCER") ? "PAYMENT_MERCHANT_NOT_CONFIGURED" : "PAYPAL_CONFIG_MISSING",
    `${name} is not configured. Integration blocked.`, "configuration",
    `Ask the administrator to add ${name} to the server environment and verify merchant ownership.`, 503, false, `Missing server setting: ${name}.`);
  if (!/^[A-Z0-9]{13}$/.test(env.PAYPAL_MERCHANT_ID!) ||
    !/^[0-9a-f-]{36}$/i.test(env.PAYPAL_FREELANCER_USER_ID!) ||
    !validEmail(env.PAYPAL_MERCHANT_EMAIL!)) throw new PaymentError("PAYMENT_MERCHANT_NOT_CONFIGURED",
      "The merchant mapping is invalid.", "configuration", "Ask the administrator to verify the Sandbox merchant ID, email and ProofPay freelancer UUID.", 503);
  return { clientId: env.PAYPAL_CLIENT_ID!.trim(), clientSecret: env.PAYPAL_CLIENT_SECRET!.trim(),
    webhookId: env.PAYPAL_WEBHOOK_ID!.trim(), merchantId: env.PAYPAL_MERCHANT_ID!,
    merchantEmail: env.PAYPAL_MERCHANT_EMAIL!.trim().toLowerCase(), freelancerId: env.PAYPAL_FREELANCER_USER_ID! };
}
export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
