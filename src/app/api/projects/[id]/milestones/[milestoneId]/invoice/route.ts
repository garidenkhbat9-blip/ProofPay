import { authorizeProject, ApiError } from "@/lib/server/http";
import { assertMerchant, paymentRpc, paymentServices, paymentStore, paymentResponseError } from "@/lib/server/payments";
import { runPayment } from "@/lib/payments/workflow";
import type { Payment } from "@/lib/payments/model";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string; milestoneId: string }> }) {
  try {
    const { id, milestoneId } = await context.params;
    const { user } = await authorizeProject(request, id, "freelancer");
    if (!/^[0-9a-f-]{36}$/i.test(milestoneId)) throw new ApiError(404, "Milestone not found.");
    const services = paymentServices();
    await assertMerchant(services);
    await services.gateway.authenticate();
    const payment = await paymentRpc<Payment>(services.admin, "prepare_paypal_payment", {
      p_actor: user.id, p_project: id, p_milestone: milestoneId,
      p_merchant: services.config.merchantId, p_fingerprint: services.fingerprint,
    });
    await assertMerchant(services, payment);
    const result = await runPayment(paymentStore(services.admin), services.gateway, payment,
      { createAndSend: true, title: "Approved ProofPay milestone", source: "api" });
    return Response.json({ paymentId: payment.id, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return paymentResponseError(error, "create_send_invoice"); }
}
