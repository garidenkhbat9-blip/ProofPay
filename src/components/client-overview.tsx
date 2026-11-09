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
  const { rows, next, metrics } = clientOverview(data, user?.id);
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
          {next.step.actor === "Freelancer" && <p>The next step is with your freelancer.</p>}
          <Link className="buttonlike co-focus-action" href={next.step.href}>{next.step.stage === 3 ? "Review evidence" : next.step.label}<span aria-hidden="true">↗</span></Link>
        </> : <>
          <h2 id="co-focus-title">{rows.length ? "No active projects" : "Create your first project"}</h2>
          <p>{rows.length ? "Your archived projects are listed below." : "Start with a brief and invite your freelancer."}</p>
        </>}
      </div>
    </section>

    <section className="co-activity" aria-label="Project activity">
      {([
        ["Active projects", metrics.active],
        ["Awaiting review", metrics.review],
        ["Awaiting freelancer", metrics.response],
        ["Payments to check", metrics.payment],
      ] as const).map(([label, count]) => <div className="co-metric" key={label}><span>{label}</span><strong>{count ?? "—"}</strong>{count === null && <small>Status unavailable</small>}</div>)}
    </section>


    <section className="co-projects" aria-labelledby="co-projects-title">
      <div className="co-section-head"><h2 id="co-projects-title">Your projects <span>{rows.length}</span></h2><button className="ghost" disabled={loading} onClick={() => void refresh()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      {rows.length ? <div className="co-project-list">{rows.map(({ project, step }) => {
        const team = projectTeam(data, project.id);
        const archived = project.status === "archived";
        return <article className="co-project" key={project.id}>
          <div className="co-project-identity"><span className="co-project-icon" aria-hidden="true"><Icon name="folder" /></span><div><h3><Link href={`/projects/${project.id}`}>{project.title}</Link></h3><p>{team.freelancer === "Not assigned" ? "Freelancer not assigned" : team.freelancer}</p></div></div>
          <div className="co-project-progress"><span className={`co-status ${archived ? "co-archived" : step?.attention ? "co-attention" : ""}`}>{overviewStatus(step, archived)}</span><Link className="co-next-link" href={step?.href || `/projects/${project.id}`}>{archived ? "View records" : step?.stage === 3 ? "Review evidence" : step?.label || "View project"}<span aria-hidden="true"> →</span></Link></div>
          <div className="co-budget"><small>Planned budget</small><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: project.currency }).format(Number(project.budget_amount))}</strong></div>
          <ProjectActions project={project} />
        </article>;
      })}</div> : <div className="co-empty"><p>No projects yet.</p></div>}
    </section>
    {next?.step && <details className="co-details"><summary>Workflow details</summary><p>{next.step.description}</p>{next.step.blocker && <p>{next.step.blocker}</p>}<p>Next: {next.step.actor}</p></details>}
    <JudgeWorkspace projectIds={projectIds} />
    <WorkflowHelp />
  </div>;
}
