import { authorizeProject, ApiError } from "@/lib/server/http";
import { assertMerchant, paymentServices, paymentStore, paymentResponseError } from "@/lib/server/payments";
import { databasePaymentError } from "@/lib/payments/errors";
import { runPayment } from "@/lib/payments/workflow";
import type { Payment } from "@/lib/payments/model";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { id, paymentId } = await context.params;
    await authorizeProject(request, id);
    if (!/^[0-9a-f-]{36}$/i.test(paymentId)) throw new ApiError(404, "Payment not found.");
    const services = paymentServices();
    const { data, error } = await services.admin.from("payments").select("*").eq("id", paymentId).eq("project_id", id).maybeSingle();
    if (error) throw databasePaymentError("load_payment", error.code);
    if (!data) throw new ApiError(404, "Payment not found.");
    const payment = data as Payment;
    await assertMerchant(services, payment);
    const result = await runPayment(paymentStore(services.admin), services.gateway, payment,
      { createAndSend: false, title: "Approved ProofPay milestone", source: "reconcile" });
    return Response.json({ paymentId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return paymentResponseError(error, "refresh_payment"); }
}
