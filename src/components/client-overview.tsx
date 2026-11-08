"use client";
import Link from "next/link";
import { useWorkspace } from "./provider";
import { Icon, Notice } from "./ui";
import { ProjectActions } from "./project-actions";
import { InvitationNotice } from "./invitation-notifications";
import { DashboardTour } from "./dashboard-tour";
import { JudgeWorkspace } from "./judge-workspace";
import { WorkflowHelp } from "./workspace-onboarding";
import { clientOverview, overviewStatus } from "@/lib/client-overview";
import { projectTeam } from "@/lib/project-management";
import { workspaceIdentity } from "@/lib/workspace-onboarding";
import "@/app/client-overview.css";

export function ClientOverview({ projectIds = [] }: { projectIds?: string[] }) {
  const { data, user, refresh, loading, setPerspective } = useWorkspace();
  const { rows, active, next, metrics, aiReview } = clientOverview(data, user?.id);
  const { displayName } = workspaceIdentity(user, data.profiles);
  const firstName = displayName === "Your account" ? "" : displayName.split(" ")[0];
  const otherProjects = data.members.some(m => m.user_id === user?.id && m.role === "freelancer" && data.projects.some(p => p.id === m.project_id));
  const unavailable = !!(data.invitationError || data.agreementError || data.deliveryError);
  return <div className="client-overview">
    <header className="co-header" data-tour="overview">
      <div><span className="co-eyebrow">Client workspace</span><h1>{firstName ? `Hello, ${firstName}.` : "Your overview."}</h1></div>
      <Link className="buttonlike co-create" href="/projects/new" data-tour="new-project"><Icon name="plus" />New project</Link>
    </header>
    <DashboardTour />
    <InvitationNotice />
    {unavailable && <Notice>Some project statuses are unavailable. <button onClick={() => void refresh()}>Retry</button></Notice>}
    {data.paymentError && <Notice>Payment status is unavailable. <Link href="/payments">Check payment setup</Link></Notice>}
    {!rows.length && otherProjects && <Notice>Your freelancer projects are in your other view. <button onClick={() => setPerspective("freelancer")}>Switch to Freelancer</button></Notice>}

    <section className="co-focus" aria-labelledby="co-focus-title">
      <div className="co-focus-main">
        <span className="co-eyebrow"><span className="co-signal" aria-hidden="true" />{next?.step?.attention ? "Next action" : next ? "In focus" : "Your next chapter"}</span>
        {next?.step ? <>
          <Link className="co-focus-project" href={`/projects/${next.project.id}`}>{next.project.title}</Link>
          <h2 id="co-focus-title">{next.step.stage === 3 ? "Review submitted work" : overviewStatus(next.step)}</h2>
          <p>{next.step.stage === 3 ? "Review the evidence against your agreement before recording a decision." : next.step.stage === 5 ? "Work approval and verified payment are separate records." : next.step.stage === 1 ? "Both parties must accept the same agreement version before delivery." : next.step.attention ? next.step.title : next.step.actor === "Freelancer" ? "The next step is with your freelancer." : next.step.description}</p>
          <Link className="buttonlike co-focus-action" href={next.step.href}>{next.step.stage === 3 ? "Review evidence" : next.step.label}<span aria-hidden="true">↗</span></Link>
        </> : <>
          <h2 id="co-focus-title">{rows.length ? "A clear view. Room for what's next." : "Good work starts with a clear brief."}</h2>
          <p>{rows.length ? "Your archived projects are retained below; reopen an eligible draft or start a new project." : "Create a project, agree on milestones, and review the work with confidence."}</p>
        </>}
      </div>
      <div className="co-focus-note"><Icon name="shield" /><strong>Work, with proof.</strong><span>Agreement → Evidence → Decision</span><small>Approval is not payment.</small></div>
    </section>

    <section className="co-activity" aria-label="Project activity">
      {([
        ["Active projects", metrics.active, "Includes open drafts"],
        ["Awaiting review", metrics.review, "Projects with submitted work"],
        ["Awaiting response", metrics.response, "Next step with freelancer"],
        ["Payment attention", metrics.payment, "Approved work to check"],
      ] as const).map(([label, count, detail]) => <div className="co-metric" key={label}><span>{label}</span><strong>{count ?? "—"}</strong><small>{count === null ? "Status unavailable" : detail}</small></div>)}
    </section>

    {aiReview?.step && <aside className="co-ai" aria-label="AI review opportunity"><span className="co-ai-mark" aria-hidden="true">✧</span><div><strong>AI-assisted evidence review</strong><p>Explore submitted text with Gemini; the decision stays with you.</p></div><Link href={aiReview.step.href}>Open evidence assistant <span aria-hidden="true">↗</span></Link></aside>}

    <section className="co-projects" aria-labelledby="co-projects-title">
      <div className="co-section-head"><div><h2 id="co-projects-title">Your projects <span>{rows.length}</span></h2><p>{active.length ? "The work in motion, and what comes next." : rows.length ? "Your retained project records." : "Your first project will appear here."}</p></div><button className="ghost" disabled={loading} onClick={() => void refresh()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      {rows.length ? <div className="co-project-list">{rows.map(({ project, step }) => {
        const team = projectTeam(data, project.id);
        const archived = project.status === "archived";
        return <article className="co-project" key={project.id}>
          <div className="co-project-identity"><span className="co-project-icon" aria-hidden="true"><Icon name="folder" /></span><div><h3><Link href={`/projects/${project.id}`}>{project.title}</Link></h3><p>{team.freelancer === "Not assigned" ? "Freelancer not assigned" : team.freelancer}</p></div></div>
          <div className="co-project-progress"><span className={`co-status ${archived ? "co-archived" : step?.attention ? "co-attention" : ""}`}>{overviewStatus(step, archived)}</span><Link className="co-next-link" href={step?.href || `/projects/${project.id}`}>{archived ? "View records" : step?.stage === 3 ? "Review evidence" : step?.label || "View project"}<span aria-hidden="true"> →</span></Link></div>
          <div className="co-budget"><small>Planned budget</small><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: project.currency }).format(Number(project.budget_amount))}</strong></div>
          <ProjectActions project={project} />
        </article>;
      })}</div> : <div className="co-empty"><Icon name="folder" /><h3>From brief to approved work.</h3><p>Start with the New project button above.</p><ol><li><span>01</span>Set the brief</li><li><span>02</span>Agree on milestones</li><li><span>03</span>Review the evidence</li></ol></div>}
      {rows.length > 0 && <p className="co-financial-note">Planned budgets are estimates, not funds held or payments collected.</p>}
    </section>
    {next?.step && <details className="co-details"><summary>Workflow details</summary><p>{next.step.description}</p>{next.step.blocker && <p>{next.step.blocker}</p>}<p>Next: {next.step.actor}</p></details>}
    <JudgeWorkspace projectIds={projectIds} />
    <WorkflowHelp />
  </div>;
}
