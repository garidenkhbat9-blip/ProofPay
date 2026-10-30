"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "./provider";
import { Badge, Empty, Heading, Notice } from "./ui";
import { bothAccepted, latestAgreement, memberRole, money, revisions } from "@/lib/domain";
import { getSupabase } from "@/lib/supabase";
import { checkoutUrl, paymentLabels, type Payment, type PaymentStatus } from "@/lib/payments/model";
import type { PaymentDiagnostic } from "@/lib/payments/errors";
import { createRefreshQueue } from "@/lib/workspace-sync";

type PublicPayment = Pick<Payment, "id" | "project_id" | "milestone_id" | "freelancer_id" | "payer_id" | "amount" | "currency" | "invoice_number" | "status" | "provider_status" | "checkout_url" | "create_retry_allowed" | "last_verified_at" | "paid_at" | "reconciliation_status" | "last_error" | "created_at">;
interface PaymentList {
  payments: PublicPayment[];
  history: { id: number; payment_id: string; project_id: string; status: PaymentStatus; created_at: string }[];
  setupError: PaymentDiagnostic | null;
  merchantFreelancerId: string | null;
  truncated: boolean;
}
function localIssue(message: string, operation: string): PaymentDiagnostic {
  return { code: "PAYPAL_PAYMENT_NOT_CONFIRMED", message, operation, cause: "The request did not return a usable response.",
    recovery: "Refresh payment status before retrying. If your session expired, sign in again.", retrySafe: true,
    requestId: crypto.randomUUID(), timestamp: new Date().toISOString() };
}
function diagnostic(error: unknown): PaymentDiagnostic {
  if (error && typeof error === "object" && "code" in error && "recovery" in error && "requestId" in error)
    return error as PaymentDiagnostic;
  return localIssue("The payment service could not be reached. No payment was confirmed by this request.", "payment_request");
}
async function paymentRequest(url: string, method = "GET") {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw localIssue("Your session could not be verified. Sign in again.", method);
  let response: Response;
  try { response = await fetch(url, { method, cache: "no-store", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(120000) }); }
  catch { throw localIssue("Payment status could not be refreshed. The payment has not been confirmed by this check.", method); }
  let body;
  try { body = await response.json(); } catch { throw localIssue("The payment service returned an unreadable response.", method); }
  if (!response.ok) throw body?.error?.code ? body.error as PaymentDiagnostic : localIssue("The payment request failed.", method);
  return body;
}
function PaymentProblem({ issue }: { issue: PaymentDiagnostic | null }) {
  if (!issue) return null;
  const setup = ["PAYPAL_CONFIG_MISSING", "PAYMENT_MERCHANT_NOT_CONFIGURED"].includes(issue.code);
  return <div className="notice" role="alert">
    <strong>{setup ? "Sandbox payments need administrator setup." : issue.message}</strong>
    <p>{setup ? "Ask the administrator to verify the freelancer's Sandbox merchant account and enable this integration. New invoice creation is blocked until setup is complete." : issue.recovery}</p>
    {!setup && ["PAYPAL_TIMEOUT", "PAYPAL_NETWORK_ERROR", "DATABASE_PAYMENT_SYNC_FAILED"].includes(issue.code) && <p>Payment status could not be refreshed. The payment has not been confirmed by this check.</p>}
    <small>{issue.code} · Reference {issue.requestId}</small>
  </div>;
}
export function PaymentWorkspace() {
  const { data, user, perspective } = useWorkspace();
  const [result, setResult] = useState<PaymentList | null>(null);
  const [loadIssue, setLoadIssue] = useState<PaymentDiagnostic | null>(null);
  const [actionIssue, setActionIssue] = useState<PaymentDiagnostic | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false), alive = useRef(true);
  const queue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);
  useEffect(() => {
    alive.current = true;
    const loader = createRefreshQueue(async () => {
      try {
        const next = await paymentRequest("/api/payments") as PaymentList;
        if (alive.current) { setResult(next); setLoadIssue(null); }
      } catch (error) { if (alive.current) setLoadIssue(diagnostic(error)); }
    });
    queue.current = loader;
    const check = () => { if (document.visibilityState === "visible" && navigator.onLine) void loader.request(false); };
    void loader.request();
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check); window.addEventListener("online", check); document.addEventListener("visibilitychange", check);
    return () => { alive.current = false; loader.dispose(); queue.current = null; clearInterval(timer); window.removeEventListener("focus", check); window.removeEventListener("online", check); document.removeEventListener("visibilitychange", check); };
  }, [user?.id]);
  const refresh = useCallback(() => queue.current?.request() ?? Promise.resolve(), []);
  async function action(key: string, url: string) {
    if (locked.current) return;
    locked.current = true; setBusy(key); setActionIssue(null);
    try { await paymentRequest(url, "POST"); }
    catch (error) { if (alive.current) setActionIssue(diagnostic(error)); }
    finally { await refresh(); locked.current = false; if (alive.current) setBusy(null); }
  }
  const projects = data.projects.filter((p) => memberRole(data, p.id, user?.id) === perspective);
  const rows = (result?.payments || []).filter((p) => projects.some((project) => project.id === p.project_id));
  const milestones = projects.flatMap((project) => {
    const agreement = latestAgreement(data, project.id);
    return data.milestones.filter((m) => m.agreement_id === agreement?.id && !rows.some((p) => p.milestone_id === m.id))
      .map((m) => ({ project, milestone: m, ready: project.status !== "archived" && !!agreement && bothAccepted(data, agreement.id) && revisions(data, m.id)[0]?.status === "approved" }));
  });
  return <>
    <Heading title={perspective === "client" ? "Payments" : "Earnings"} subtitle="PayPal Sandbox · Test payments only">
      <button disabled={!!busy} onClick={() => void refresh()}>Refresh history</button>
    </Heading>
    <section className="overview"><div className="stat"><div className="statlabel">Planned project budget · not collected</div><div className="statvalue">{money(projects.reduce((sum, p) => sum + Number(p.budget_amount), 0))}</div></div></section>
    <Notice>The assigned freelancer invoices the project client using their verified Sandbox merchant account. Approval alone does not make a payment.</Notice>
    <PaymentProblem issue={loadIssue} /><PaymentProblem issue={result?.setupError || null} /><PaymentProblem issue={actionIssue} />
    {!result && !loadIssue && <p role="status">Loading payment history...</p>}
    {result && rows.map((p) => {
      const href = checkoutUrl(p.checkout_url);
      return <section className="card" key={p.id} id={"payment-" + p.milestone_id}>
        <div className="sectionhead"><h2>{data.milestones.find((m) => m.id === p.milestone_id)?.title || "Milestone invoice"}</h2><Badge status={p.status === "PAID" ? "approved" : ""}>{paymentLabels[p.status]}</Badge></div>
        <p>{data.projects.find((project) => project.id === p.project_id)?.title} · {money(p.amount)} {p.currency}</p>
        <p className="subtle">Invoice {p.invoice_number} · {p.last_verified_at ? "Last checked " + new Date(p.last_verified_at).toLocaleString() : "Not yet verified with PayPal"}</p>
        {p.reconciliation_status === "ERROR" && <Notice>Payment status could not be refreshed. The payment has not been confirmed by this check. Previously verified information is retained.</Notice>}
        {p.status === "PAYMENT_PENDING" && <p>Payment is pending. Wait for PayPal confirmation, then refresh. Do not pay again.</p>}
        {p.status === "UNPAID" && !href && <Notice>PayPal has not provided a verified Sandbox checkout link. Refresh payment status, then ask the merchant to inspect the invoice in their Sandbox dashboard if the link remains unavailable.</Notice>}
        {p.status === "REQUIRES_ATTENTION" && <p>PayPal payment has not been confirmed. Ask the merchant to inspect this invoice; manual or external payment records are not treated as PayPal payments.</p>}
        <PaymentProblem issue={p.last_error} />
        <div className="actions">
          {(["DRAFT", "NOT_STARTED"].includes(p.status) || p.create_retry_allowed) && user?.id === p.freelancer_id && !result.setupError && <button disabled={!!busy} onClick={() => void action(p.id, `/api/projects/${p.project_id}/milestones/${p.milestone_id}/invoice`)}>{p.status === "DRAFT" ? "Send Sandbox invoice" : "Create & send Sandbox invoice"}</button>}
          {p.status === "UNPAID" && href && user?.id === p.payer_id && <a className="buttonlike primary" href={href} target="_blank" rel="noopener noreferrer">Pay on PayPal Sandbox</a>}
          <button disabled={!!busy || !!result.setupError} onClick={() => void action(p.id, `/api/projects/${p.project_id}/payments/${p.id}/refresh`)}>{busy === p.id ? "Checking..." : "Refresh PayPal status"}</button>
          <Link className="buttonlike" href={`/projects/${p.project_id}/delivery`}>View milestone</Link>
        </div>
      </section>;
    })}
    {result && milestones.map(({ project, milestone: m, ready }) => <section className="card" key={m.id}>
      <div className="sectionhead"><h2>{m.title}</h2><Badge>{ready ? "Ready for Payment" : "Awaiting Approval"}</Badge></div>
      <p>{project.title} · {money(m.amount)} USD</p>
      {ready && Number(m.amount) === 0 ? <p>No payment is required for this zero-value milestone.</p> : ready && perspective === "freelancer" && user?.id === result.merchantFreelancerId && !result.setupError ?
        <button className="primary" disabled={!!busy} onClick={() => void action(m.id, `/api/projects/${project.id}/milestones/${m.id}/invoice`)}>{busy === m.id ? "Preparing invoice..." : "Create & send Sandbox invoice"}</button>
        : <p>{ready ? "The assigned freelancer must have a verified merchant connection before issuing the invoice." : "Both parties must accept the agreement and the client must approve the delivery."}</p>}
    </section>)}
    {result && !rows.length && !milestones.length && <Empty>No milestone invoices yet. <Link href="/projects">View projects</Link></Empty>}
    {result && <section className="card"><h2>Payment history</h2>{result.history.filter((h) => rows.some((p) => p.id === h.payment_id)).map((h) => <p key={h.id}>{new Date(h.created_at).toLocaleString()} · {rows.find((p) => p.id === h.payment_id)?.invoice_number} · {paymentLabels[h.status] || "Action Required"}</p>)}{!result.history.length && <p>No verified payment events yet.</p>}{result.truncated && <p>Showing recent records only. Contact support for older history.</p>}</section>}
  </>;
}
