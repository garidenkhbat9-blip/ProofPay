// Local configuration + OAuth + bounded SELECTs only. No invoices/emails or writes.
// Run with Node --env-file=.env.local --import tsx scripts/payment-launch-readonly.ts.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { paymentConfig } from "../src/lib/payments/config";
import { PayPalGateway } from "../src/lib/payments/gateway";
import { PaymentError } from "../src/lib/payments/errors";
const report = (check: string, status: string, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ check, status, ...details }));
async function main() {
  let config;
  try { config = paymentConfig(process.env); report("local Sandbox configuration shape", "VERIFIED"); }
  catch { report("local Sandbox configuration shape", "BLOCKED"); return; }
  try { await new PayPalGateway(config).authenticate(); report("Sandbox OAuth only", "VERIFIED", { financialActions: 0 }); }
  catch (error) { report("Sandbox OAuth only", "BLOCKED", { code: error instanceof PaymentError ? error.diagnostic.code : "UNAVAILABLE" }); }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) { report("merchant binding read", "BLOCKED"); return; }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) }) } });
  const binding = await admin.from("paypal_merchant_bindings").select("active,verified_at,merchant_id,merchant_email,credential_fingerprint").eq("freelancer_id", config.freelancerId).limit(10);
  if (binding.error || !binding.data) { report("merchant binding read", "BLOCKED", { httpStatus: binding.status }); return; }
  const matches = binding.data.some(b => b.active && b.verified_at && b.merchant_id === config.merchantId && b.merchant_email === config.merchantEmail && b.credential_fingerprint === createHash("sha256").update(config.clientId).digest("hex"));
  report("configured merchant binding matches", matches ? "VERIFIED" : "BLOCKED");
  const identity = await admin.auth.admin.getUserById(config.freelancerId);
  report("configured merchant confirmed identity", !identity.error && identity.data.user?.email_confirmed_at ? "VERIFIED" : "BLOCKED");
  const roles = await admin.from("project_members").select("role").eq("user_id", config.freelancerId).limit(100);
  report("configured merchant project roles", roles.error ? "BLOCKED" : "VERIFIED", { roles: roles.error ? [] : roles.data?.map(r => r.role), boundedTo: 100 });
  report("provider invoice/payment and deployed parity", "UNVERIFIED");
}
main().catch(() => { report("read-only check", "BLOCKED"); process.exitCode = 1; });
