"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { useWorkspace } from "./provider";
import {
  DEMO_PAYMENT,
  demoAmount,
  demoPaymentReducer,
  demoStatusLabels,
  demoStep,
  initialDemoPayment,
} from "@/lib/demo-payment";
import "@/app/demo-payment.css";

export function DemoPaymentPage() {
  const { user, ready, authError } = useWorkspace();
  // WorkspaceShell handles login redirects. No sample controls before Auth is ready.
  if (!ready || !user || authError) return null;
  return <DemoPayment key={user.id} />;
}
function DemoPayment() {
  const [state, dispatch] = useReducer(demoPaymentReducer, initialDemoPayment);
  const [view, setView] = useState<"client" | "freelancer">("client");
  const { status } = state,
    step = demoStep(status);
  const actionArea = useRef<HTMLDivElement>(null),
    previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current !== status) {
      actionArea.current?.querySelector<HTMLElement>("button,a")?.focus();
      previousStatus.current = status;
    }
  }, [status]);
  const completed = status === "PAID_SIMULATED",
    failed = status === "FAILED_SIMULATED",
    cancelled = status === "CANCELLED_SIMULATED";
  const stages = [
    "Milestone ready",
    "Demo invoice",
    "Buyer action",
    "Simulated completion",
  ];
  const descriptions = [
    "Fictional work, ready to explore.",
    "A local sample. Nothing is sent.",
    "Practice confirmation or failure.",
    "No funds move. No records change.",
  ];
  function reset() {
    dispatch("RESET");
    setView("client");
  }
  return (
    <div className="demo-payment" data-demo-status={status}>
      <Link className="dp-back" href="/payments">
        ← Payments
      </Link>
      <header className="dp-header">
        <div>
          <span className="dp-eyebrow">ProofPay / Demo payment</span>
          <h1>
            Practice the payment.
            <br />
            <span>Keep it imaginary.</span>
          </h1>
          <p>One fictional milestone. Every step, safely simulated.</p>
        </div>
        <div
          className="dp-perspective"
          role="group"
          aria-label="Demo perspective"
        >
          <span>Illustrative view only</span>
          <div>
            {(["client", "freelancer"] as const).map((role) => (
              <button
                key={role}
                aria-pressed={view === role}
                onClick={() => setView(role)}
              >
                {role === "client" ? "Client demo" : "Freelancer demo"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <p className="dp-disclosure">
        <strong>SIMULATION</strong> No real money. No PayPal transaction. Your
        projects and payment records stay unchanged.
      </p>
      <div className="dp-workspace">
        <section className="dp-journey" aria-labelledby="dp-timeline-title">
          <span className="dp-eyebrow">The payment journey</span>
          <h2 id="dp-timeline-title">
            From invoice
            <br />
            to understanding.
          </h2>
          <ol>
            {stages.map((label, index) => (
              <li
                key={label}
                className={
                  index < step ? "done" : index === step ? "current" : ""
                }
                aria-current={index === step ? "step" : undefined}
              >
                <span className="dp-step" aria-hidden="true">
                  {index < step ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{label}</h3>
                  <p>
                    {index === step && failed
                      ? "Simulated failure. Retry when ready."
                      : index === step && cancelled
                        ? "Demo cancelled. Reset to start again."
                        : descriptions[index]}
                  </p>
                  <small>
                    {index < step
                      ? "Simulated step complete"
                      : index === step
                        ? "Current step"
                        : "Next step"}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <p className="dp-memory">
            Progress lives only in this open page. Refreshing, leaving or
            switching accounts resets the demo.
          </p>
        </section>
        <section className="dp-sample" aria-label="Fictional sample invoice">
          <div className="dp-sample-top">
            <span className="dp-eyebrow">Fictional sample / USD</span>
            <button className="dp-reset" onClick={reset}>
              Reset demo
            </button>
          </div>
          <p className="dp-project">{DEMO_PAYMENT.project}</p>
          <h2>{DEMO_PAYMENT.milestone}</h2>
          <div className="dp-amount">
            <strong>{demoAmount()}</strong>
            <span>Simulated amount · not payable</span>
          </div>
          <dl className="dp-invoice">
            <div>
              <dt>From</dt>
              <dd>Sample freelancer</dd>
            </div>
            <div>
              <dt>For</dt>
              <dd>Sample client</dd>
            </div>
            <div>
              <dt>Line item</dt>
              <dd>Homepage UI Design · $10.00</dd>
            </div>
          </dl>
          <div
            className={`dp-result ${failed || cancelled ? "attention" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="dp-eyebrow">
              {view === "client" ? "Client demo" : "Freelancer demo"}
            </span>
            <h3>{demoStatusLabels[status]}</h3>
            <p>
              {completed
                ? view === "freelancer"
                  ? "Simulated earnings: USD 10.00. No money was received; nothing was added to your earnings."
                  : "You completed the practice payment. No money was charged or transferred."
                : failed
                  ? "This is a deliberate demo failure. No charge occurred; retry the same fictional invoice."
                  : cancelled
                    ? "Only this local demo was cancelled. No real invoice or contract changed."
                    : status === "READY"
                      ? "Prepare a sample invoice without an account connection, project or agreement."
                      : status === "INVOICE_CREATED"
                        ? "Your sample invoice exists only on this page. No email or payment link was created."
                        : view === "freelancer"
                          ? "The sample invoice is waiting for a simulated buyer. Try the Client demo view to continue."
                          : "Review the $10.00 sample above, then simulate the buyer’s confirmation."}
            </p>
          </div>
          <div className="dp-main-action" ref={actionArea}>
            {status === "READY" && (
              <button
                className="primary"
                onClick={() => dispatch("CREATE_INVOICE")}
              >
                Create demo invoice →
              </button>
            )}
            {status === "INVOICE_CREATED" && (
              <button
                className="primary"
                onClick={() => {
                  dispatch("REVIEW_INVOICE");
                  setView("client");
                }}
              >
                Review demo invoice →
              </button>
            )}
            {status === "PAYMENT_PENDING" && (
              <button
                className="primary"
                onClick={() =>
                  view === "client" ? dispatch("CONFIRM") : setView("client")
                }
              >
                {view === "client"
                  ? "Simulate $10.00 payment"
                  : "Try Client demo view"}{" "}
                →
              </button>
            )}
            {failed && (
              <button className="primary" onClick={() => dispatch("RETRY")}>
                Retry demo payment →
              </button>
            )}
            {cancelled && (
              <button className="primary" onClick={reset}>
                Start new demo →
              </button>
            )}
            {completed && (
              <Link className="buttonlike primary" href="/payments">
                Back to Payments →
              </Link>
            )}
          </div>
          {!["READY", "PAID_SIMULATED", "CANCELLED_SIMULATED"].includes(
            status,
          ) && (
            <details className="dp-options">
              <summary>Explore another outcome</summary>
              <div>
                {status === "PAYMENT_PENDING" && (
                  <button onClick={() => dispatch("FAIL")}>
                    Simulate failure
                  </button>
                )}
                <button onClick={() => dispatch("CANCEL")}>
                  Cancel demo invoice
                </button>
              </div>
            </details>
          )}
        </section>
      </div>
      <footer className="dp-footer">
        <strong>Demo payment ≠ PayPal Sandbox</strong>
        <span>
          Sandbox integration uses real provider test accounts and verified
          records. This practice flow uses neither.
        </span>
      </footer>
    </div>
  );
}
