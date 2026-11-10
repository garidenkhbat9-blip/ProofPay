import { cents, type Payment } from "./payments/model";
type SummaryPayment = Pick<Payment, "amount" | "currency" | "status" | "last_verified_at" | "reconciliation_status">;
export function paymentSummary(rows: SummaryPayment[]) {
  let paid = 0, open = 0, invoiced = 0;
  for (const row of rows) {
    if (row.currency !== "USD" || row.reconciliation_status === "ERROR" || row.status === "REQUIRES_ATTENTION") return null;
    let amount: number;
    try { amount = cents(row.amount); } catch { return null; }
    if (["DRAFT", "UNPAID", "PAYMENT_PENDING", "PAID", "CANCELLED", "REFUNDED"].includes(row.status)) invoiced += amount;
    if (["UNPAID", "PAYMENT_PENDING"].includes(row.status)) open += amount;
    if (row.status === "PAID") {
      if (!row.last_verified_at || row.reconciliation_status !== "SYNCED") return null;
      paid += amount;
    }
  }
  return {paid: paid / 100, open: open / 100, invoiced: invoiced / 100};
}
