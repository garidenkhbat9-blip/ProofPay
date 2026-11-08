"use client";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "./provider";
import { Icon, Notice } from "./ui";
import { DashboardTour } from "./dashboard-tour";
import { JudgeWorkspace } from "./judge-workspace";
import { WorkflowHelp } from "./workspace-onboarding";
import {
  InvitationNotice,
  useInvitationNotifications,
} from "./invitation-notifications";
import {
  freelancerWorkspace,
  type FreelancerJob,
} from "@/lib/freelancer-workspace";
import { workspaceIdentity } from "@/lib/workspace-onboarding";
import "@/app/freelancer-workspace.css";

function WorkspaceFeedback() {
  const { data, refresh } = useWorkspace();
  return (
    <>
      {(data.invitationError || data.agreementError || data.deliveryError) && (
        <Notice>
          Some job records are unavailable.{" "}
          <button onClick={() => void refresh()}>Retry</button>
        </Notice>
      )}
      {data.paymentError && (
        <Notice>
          Payment status is unavailable.{" "}
          <Link href="/payments">View payment setup</Link>
        </Notice>
      )}
    </>
  );
}

export function FreelancerOverview({
  projectIds = [],
}: {
  projectIds?: string[];
}) {
  const { data, user, loading, refresh, setPerspective } = useWorkspace();
  const model = freelancerWorkspace(data, user?.id);
  const invitations = useInvitationNotifications();
  const { displayName } = workspaceIdentity(user, data.profiles);
  const name = displayName === "Your account" ? "" : displayName.split(" ")[0];
  const next = model.next;
  const inviteFirst = !!invitations.count && (!next || next.priority < 70);
  const otherRole =
    !model.jobs.length &&
    data.members.some(
      (m) =>
        m.user_id === user?.id &&
        m.role === "client" &&
        data.projects.some((p) => p.id === m.project_id),
    );
  return (
    <div className="freelancer-workspace">
      <header className="fw-header" data-tour="overview">
        <div>
          <span className="fw-eyebrow">Freelancer workspace</span>
          <h1>{name ? `Your work, ${name}.` : "Your work, in focus."}</h1>
          <p>
            {model.active.length
              ? `${model.active.length} active job${model.active.length === 1 ? "" : "s"}. One clear next step.`
              : "A clear place for your next collaboration."}
          </p>
        </div>
        <span className="fw-brand-mark" aria-hidden="true">
          <Icon name="compass" />
        </span>
      </header>
      <DashboardTour />
      <WorkspaceFeedback />
      <InvitationNotice />
      {otherRole && (
        <Notice>
          Your client projects are in your other view.{" "}
          <button onClick={() => setPerspective("client")}>
            Switch to Client
          </button>
        </Notice>
      )}
      <section className="fw-summary" aria-label="Your action summary">
        {(
          [
            [
              "Pending invitations",
              invitations.count,
              invitations.stale ? "Last known status" : "Ready to review",
            ],
            ["Jobs to deliver", model.deliveryCount, "Your delivery is next"],
            [
              "Waiting for client",
              model.waitingCount,
              "Acceptance, access or review",
            ],
            ["Payment attention", model.paymentCount, "Approved work to check"],
          ] as const
        ).map(([label, count, detail]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count ?? "—"}</strong>
            <small>{count === null ? "Status unavailable" : detail}</small>
          </div>
        ))}
      </section>
      <section className="fw-focus" aria-labelledby="fw-focus-title">
        <div className="fw-focus-copy">
          <span className="fw-eyebrow">
            {inviteFirst || next?.priority
              ? "Your next action"
              : next
                ? "Waiting, with clarity"
                : "Ready for your next job"}
          </span>
          {inviteFirst ? (
            <>
              <h2 id="fw-focus-title">A new collaboration starts here.</h2>
              <p>
                Review the project invitation before joining; agreement
                acceptance is a separate step.
              </p>
              <Link className="buttonlike fw-primary" href="/invitations">
                Review invitations <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : next ? (
            <>
              <Link
                className="fw-project-link"
                href={`/projects/${next.project.id}`}
              >
                {next.project.title}
              </Link>
              <h2 id="fw-focus-title">{next.status}</h2>
              <p>
                {next.delivery
                  ? `${next.delivery.milestone.title} is ready for your ${next.delivery.submission?.status === "changes" ? "revision" : "delivery"}.`
                  : next.step?.stage === 1
                    ? "Both parties must accept the same agreement version before delivery."
                    : next.actor === "Client's action"
                      ? "Your client has the next step; open the job to check the latest records."
                      : next.paymentAttention
                        ? "Approval is recorded; check the separate invoice and verified payment status."
                        : next.unavailable
                          ? "Refresh your workspace to check the current job state."
                          : "Your agreements, evidence and payment records remain available."}
              </p>
              <Link className="buttonlike fw-primary" href={next.href}>
                {next.label}
                <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              <h2 id="fw-focus-title">Good work starts with an invitation.</h2>
              <p>
                {model.jobs.length
                  ? "Your archived job records are retained below."
                  : "Ask your client to invite your verified account email to join a project."}
              </p>
              <Link className="buttonlike fw-primary" href="/invitations">
                View invitations <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
        <aside className="fw-focus-aside">
          <Icon name={inviteFirst || next?.priority ? "briefcase" : "clock"} />
          <strong>
            {inviteFirst ? "Your decision" : next?.actor || "No action waiting"}
          </strong>
          <span>
            {next?.deadline && !inviteFirst
              ? next.deadline
              : "Clear scope. Evidence-backed work."}
          </span>
          <small>Approval does not confirm payment.</small>
        </aside>
      </section>
      <section className="fw-jobs" aria-labelledby="fw-jobs-title">
        <div className="fw-section-head">
          <h2 id="fw-jobs-title">
            My jobs <span>{model.jobs.length}</span>
          </h2>
          <button
            className="ghost"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <FreelancerJobRows jobs={model.jobs.slice(0, 5)} />
        {model.jobs.length > 5 && (
          <Link className="fw-all-jobs" href="/projects">
            View all {model.jobs.length} jobs →
          </Link>
        )}
      </section>
      <JudgeWorkspace projectIds={projectIds} />
      <WorkflowHelp />
    </div>
  );
}

export function FreelancerJobRows({ jobs }: { jobs: FreelancerJob[] }) {
  const { data } = useWorkspace();
  if (!jobs.length)
    return (
      <div className="fw-empty">
        <Icon name="folder" />
        <div>
          <h3>No jobs here yet.</h3>
          <p>
            Accepted invitations appear here; use Invitations to review incoming
            work.
          </p>
        </div>
      </div>
    );
  return (
    <div className="fw-job-list">
      {jobs.map((job) => {
        const submissions = data.submissions.filter(
          (s) => s.project_id === job.project.id,
        );
        const feedback =
          job.delivery?.submission?.status === "changes"
            ? data.reviews
                .filter(
                  (r) =>
                    r.submission_id === job.delivery!.submission!.id &&
                    r.decision === "changes",
                )
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
            : null;
        return (
          <article className="fw-job" key={job.project.id}>
            <div className="fw-job-main">
              <div className="fw-job-title">
                <h3>
                  <Link href={`/projects/${job.project.id}`}>
                    {job.project.title}
                  </Link>
                </h3>
                <p>
                  {job.clientName}
                  {job.deadline && <span> · {job.deadline}</span>}
                </p>
              </div>
              <div className="fw-job-state">
                <span
                  className={`fw-status ${job.priority >= 70 ? "fw-action" : job.paid ? "fw-paid" : "fw-waiting"}`}
                >
                  {job.status}
                </span>
                <small>{job.actor}</small>
              </div>
              <Link className="fw-job-action" href={job.href}>
                {job.label}
                <span aria-hidden="true"> ↗</span>
              </Link>
            </div>
            <details className="fw-job-details">
              <summary>Job details</summary>
              <div className="fw-detail-grid">
                <div>
                  <strong>Agreement</strong>
                  <Link href={`/projects/${job.project.id}/agreement`}>
                    {job.agreement
                      ? `Review version ${job.agreement.version}`
                      : "View agreement status"}
                  </Link>
                  <small>Both parties must accept the same version.</small>
                </div>
                <div>
                  <strong>Delivery & feedback</strong>
                  <Link href={`/projects/${job.project.id}/delivery`}>
                    Submission history ({submissions.length})
                  </Link>
                  {job.deliveries.length > 1 && (
                    <small>
                      {job.deliveries.length} milestones available to deliver
                    </small>
                  )}
                  {feedback?.note && (
                    <p className="fw-feedback">{feedback.note}</p>
                  )}
                </div>
                <div>
                  <strong>Payment records</strong>
                  <Link href="/payments">
                    {job.paid
                      ? "View verified Sandbox payment"
                      : "Check invoice status"}
                  </Link>
                  <small>
                    Approval is not payment; no earnings total is inferred.
                  </small>
                </div>
              </div>
            </details>
          </article>
        );
      })}
    </div>
  );
}

export function MyJobsPage() {
  const { data, user, refresh, loading } = useWorkspace();
  const { jobs } = freelancerWorkspace(data, user?.id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = jobs.filter(
    (j) =>
      j.project.title.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === "all" ||
        (filter === "action" && j.priority >= 70) ||
        (filter === "waiting" && j.waitingClient) ||
        (filter === "archived" && j.project.status === "archived")),
  );
  return (
    <div className="freelancer-workspace">
      <header className="fw-header">
        <div>
          <span className="fw-eyebrow">Freelancer workspace</span>
          <h1>My jobs</h1>
          <p>Your commitments, and whose turn it is.</p>
        </div>
        <button disabled={loading} onClick={() => void refresh()}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      <WorkspaceFeedback />
      <InvitationNotice />
      <div className="fw-filters">
        <input
          className="field"
          aria-label="Search jobs"
          placeholder="Search jobs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="field"
          aria-label="Filter jobs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All jobs</option>
          <option value="action">Your action</option>
          <option value="waiting">Waiting for client</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <p className="fw-result" role="status">
        {shown.length} of {jobs.length} jobs
      </p>
      <section className="fw-jobs" aria-label="Jobs">
        {jobs.length && !shown.length ? (
          <div className="fw-empty">
            <p>No matching jobs. Try a different search or filter.</p>
          </div>
        ) : (
          <FreelancerJobRows jobs={shown} />
        )}
      </section>
    </div>
  );
}
