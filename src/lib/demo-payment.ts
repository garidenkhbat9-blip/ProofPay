/** Fictional learning state. Deliberately has no financial/backend imports. */
export const DEMO_PAYMENT = Object.freeze({
  project: "Demo Website Design",
  milestone: "Homepage UI Design",
  amountMinor: 1000,
  currency: "USD" as const,
});
export type DemoPaymentStatus =
  | "READY"
  | "INVOICE_CREATED"
  | "PAYMENT_PENDING"
  | "PAID_SIMULATED"
  | "FAILED_SIMULATED"
  | "CANCELLED_SIMULATED";
export type DemoPaymentAction =
  | "CREATE_INVOICE"
  | "REVIEW_INVOICE"
  | "CONFIRM"
  | "FAIL"
  | "RETRY"
  | "CANCEL"
  | "RESET";
export interface DemoPaymentState {
  readonly mode: "SIMULATION";
  readonly status: DemoPaymentStatus;
}
export const initialDemoPayment: DemoPaymentState = Object.freeze({
  mode: "SIMULATION",
  status: "READY",
});
const transitions: Partial<
  Record<
    DemoPaymentStatus,
    Partial<Record<DemoPaymentAction, DemoPaymentStatus>>
  >
> = {
  READY: { CREATE_INVOICE: "INVOICE_CREATED" },
  INVOICE_CREATED: {
    REVIEW_INVOICE: "PAYMENT_PENDING",
    CANCEL: "CANCELLED_SIMULATED",
  },
  PAYMENT_PENDING: {
    CONFIRM: "PAID_SIMULATED",
    FAIL: "FAILED_SIMULATED",
    CANCEL: "CANCELLED_SIMULATED",
  },
  FAILED_SIMULATED: { RETRY: "PAYMENT_PENDING", CANCEL: "CANCELLED_SIMULATED" },
};
export function demoPaymentReducer(
  state: DemoPaymentState,
  action: DemoPaymentAction,
): DemoPaymentState {
  if (action === "RESET") return initialDemoPayment;
  const status = transitions[state.status]?.[action];
  return status ? { mode: "SIMULATION", status } : state;
}
export const demoAmount = (minor = DEMO_PAYMENT.amountMinor) =>
  `USD ${(minor / 100).toFixed(2)}`;
export const demoStatusLabels: Record<DemoPaymentStatus, string> = {
  READY: "Demo milestone prepared",
  INVOICE_CREATED: "Demo invoice created — simulated",
  PAYMENT_PENDING: "Demo payment pending — simulated",
  PAID_SIMULATED: "Demo payment completed — simulated",
  FAILED_SIMULATED: "Demo payment failed — simulated",
  CANCELLED_SIMULATED: "Demo payment cancelled — simulated",
};
export function demoStep(status: DemoPaymentStatus) {
  return status === "READY"
    ? 0
    : status === "INVOICE_CREATED"
      ? 1
      : status === "PAID_SIMULATED"
        ? 3
        : 2;
}
