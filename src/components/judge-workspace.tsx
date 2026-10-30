"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./provider";
import { Heading, Icon, Badge } from "./ui";
import { judgeProjects, judgeProgress } from "@/lib/judge-access";
import { projectNextStep } from "@/lib/project-workflow";
import { getSupabase } from "@/lib/supabase";
import { paymentLabels, type Payment } from "@/lib/payments/model";
import type { Role } from "@/lib/types";

type PaymentSnapshot = Pick<
  Payment,
  | "id"
  | "project_id"
  | "invoice_number"
  | "status"
  | "last_verified_at"
  | "reconciliation_status"
>;
type PaymentResult = {
  payments: PaymentSnapshot[];
  setupError: unknown;
  truncated: boolean;
};

function JudgePaymentStatus({ projectId }: { projectId: string }) {
  const { user } = useWorkspace();
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setResult(null);
    setFailed(false);
    async function read() {
      try {
        const { data, error } = await getSupabase().auth.getSession();
        if (error || !data.session) throw new Error("Sign in required");
        const response = await fetch("/api/payments", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
        if (!response.ok) throw new Error("Payment history unavailable");
        const body = (await response.json()) as PaymentResult;
        if (!Array.isArray(body.payments))
          throw new Error("Invalid payment history");
        if (alive) setResult(body);
      } catch {
        if (alive) setFailed(true);
      }
    }
    void read();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [user?.id, attempt]);
  const rows = result?.payments.filter((p) => p.project_id === projectId) || [];
  return (
    <div className="judge-payment" aria-live="polite">
      <div className="sectionhead">
        <h3>PayPal Sandbox</h3>
        <Badge>Test payments only</Badge>
      </div>
      {failed ? (
        <p>
          Payment status unavailable.{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Retry status</button>
        </p>
      ) : !result ? (
        <p role="status">Loading recorded payment status…</p>
      ) : (
        <>
          {rows.map((p) => (
            <div className="judge-invoice" key={p.id}>
              <strong>{p.invoice_number}</strong>
              <span>
                {p.status === "PAID" && !p.last_verified_at
                  ? "Payment confirmation unavailable"
                  : paymentLabels[p.status] || "Status unavailable"}
              </span>
              {p.reconciliation_status === "ERROR" && (
                <small>
                  Latest check failed. Open payment history to review the last
                  verified record.
                </small>
              )}
            </div>
          ))}
          {!rows.length && (
            <p>
              {result.truncated
                ? "No invoices in the loaded history for this project."
                : "No invoice recorded for this project."}
            </p>
          )}
          {!!result.setupError && (
            <p>
              Merchant setup needs attention. Ask the organizer to verify the
              Sandbox connection.
            </p>
          )}
        </>
      )}
      <Link href="/payments">
        Open payment history <span aria-hidden="true">→</span>
      </Link>
      <small>
        Approval does not confirm payment. This view reads recorded status; it
        never creates an invoice or starts a payment.
      </small>
    </div>
  );
}

export function JudgeWorkspace({
  projectIds,
  initialRole,
}: {
  projectIds: string[];
  initialRole: Role | null;
}) {
  const { data, user, perspective, setPerspective, error, refresh } =
    useWorkspace();
  const appliedRole = useRef<Role | null | undefined>(undefined);
  useEffect(() => {
    if (appliedRole.current !== initialRole) {
      appliedRole.current = initialRole;
      if (initialRole) setPerspective(initialRole);
    }
  }, [initialRole, setPerspective]);
  const projects = judgeProjects(data, projectIds, user?.id, perspective);
  const [selected, setSelected] = useState("");
  const project = projects.find((p) => p.id === selected) || projects[0];
  const progress = project ? judgeProgress(data, project.id) : null;
  const next = project ? projectNextStep(data, project, user?.id) : null;
  return (
    <div className="judge-workspace">
      <Heading
        title="Your ProofPay experience"
        subtitle="Agree on the work. Review the proof. Keep payment a deliberate next step."
      >
        <Badge>{perspective === "client" ? "Client" : "Freelancer"} view</Badge>
      </Heading>
      <div className="judge-session">
        <Icon name="shield" />
        <div>
          <strong>Signed in as {user?.email}</strong>
          <p>
            Your own account · Designated Sandbox projects · Permissions follow
            project membership
          </p>
        </div>
        <Link href="/settings">Account settings</Link>
      </div>
      {error ? (
        <div className="card empty">
          <h2>Refresh your project records</h2>
          <p>
            Project status could not be refreshed. Reload the records before
            continuing.
          </p>
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      ) : !project ? (
        <section className="judge-setup card">
          <span className="judge-icon">
            <Icon name="folder" />
          </span>
          <span className="judge-eyebrow">LET’S GET YOU READY</span>
          <h2>
            {projectIds.length
              ? "Your prepared project is not available in this view yet."
              : "Your Sandbox project needs setup."}
          </h2>
          <p>
            {projectIds.length
              ? "Accept the organizer’s invitation using the invited email. If you already joined, check that your Client or Freelancer view matches your project role."
              : "Ask the organizer to prepare a Sandbox project, designate it for judging, and invite your account. No sample records have been added to your workspace."}
          </p>
          <div className="actions">
            <Link className="buttonlike forest" href="/invitations">
              Check invitations
            </Link>
            <button onClick={() => void refresh()}>Refresh projects</button>
            <Link className="buttonlike" href="/demo">
              Explore simulated demo
            </Link>
          </div>
          <ol className="judge-setup-steps">
            <li>
              <strong>Use your invited email</strong>
              <span>Each judge signs in to their own account.</span>
            </li>
            <li>
              <strong>Join the prepared project</strong>
              <span>The organizer assigns your project role.</span>
            </li>
            <li>
              <strong>Follow the next action</strong>
              <span>
                Real records guide you from agreement to Sandbox payment.
              </span>
            </li>
          </ol>
        </section>
      ) : (
        <>
          <div className="judge-project-heading">
            <div>
              <span className="judge-eyebrow">DESIGNATED SANDBOX PROJECT</span>
              <h2>{project.title}</h2>
            </div>
            {projects.length > 1 && (
              <label>
                Project
                <select
                  className="field"
                  value={project.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <dl className="judge-status-grid">
            {[
              ["01", "Agreement", progress!.agreement],
              ["02", "Evidence", progress!.evidence],
              ["03", "Human review", progress!.review],
            ].map(([number, title, status]) => (
              <div key={number}>
                <span>{number}</span>
                <dt>{title}</dt>
                <dd>{status}</dd>
              </div>
            ))}
          </dl>
          {next && (
            <section className="judge-next">
              <div>
                <span className="judge-eyebrow">YOUR NEXT STEP</span>
                <h2>{next.title}</h2>
                <p>{next.description}</p>
              </div>
              <Link className="buttonlike forest" href={next.href}>
                {next.label} <span aria-hidden="true">→</span>
              </Link>
            </section>
          )}
          <JudgePaymentStatus key={user?.id} projectId={project.id} />
        </>
      )}
      <div className="judge-capabilities">
        <div>
          <Icon name="report" />
          <strong>AI-assisted agreements</strong>
          <p>
            Generate a draft when Gemini is configured. Review and save it
            yourself.
          </p>
        </div>
        <div>
          <Icon name="eye" />
          <strong>Human evidence review</strong>
          <p>
            Files, links and revisions remain inspectable. Automated
            verification is not connected.
          </p>
        </div>
        <div>
          <Icon name="wallet" />
          <strong>Explicit payment decisions</strong>
          <p>
            Only an authorized merchant can issue a Sandbox invoice after
            approval.
          </p>
        </div>
      </div>
    </div>
  );
}
