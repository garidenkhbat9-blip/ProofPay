import { authenticatedPayments, paymentColumns, paymentResponseError, paymentServices, assertMerchant } from "@/lib/server/payments";
import { databasePaymentError, PaymentError } from "@/lib/payments/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { client, user } = await authenticatedPayments(request);
    const [payments, history] = await Promise.all([
      client.from("payments").select(paymentColumns).order("created_at", { ascending: false }).limit(500),
      client.from("payment_history").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (payments.error || history.error) throw databasePaymentError("list_payments", (payments.error || history.error)?.code);
    let setupError = null;
    let merchantFreelancerId: string | null = null;
    try {
      const services = paymentServices();
      await assertMerchant(services);
      merchantFreelancerId = user.id === services.config.freelancerId ? user.id : null;
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      setupError = error.diagnostic;
    }
    return Response.json({ payments: payments.data, history: history.data, setupError, merchantFreelancerId,
      truncated: payments.data.length === 500 || history.data.length === 200 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return paymentResponseError(error, "list_payments"); }
}
