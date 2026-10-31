import Link from "next/link";
import { Icon } from "./ui";
import { onboarding } from "@/lib/workspace-onboarding";
import type { Role } from "@/lib/types";

export function WorkspaceOnboarding({ perspective, pendingInvitation }: { perspective: Role; pendingInvitation: boolean }) {
  const guide = onboarding[perspective];
  return <section className="onboard workspace-onboard" aria-labelledby="onboarding-title">
    <div className="onboard-icon"><Icon name={perspective === "client" ? "folder" : "report"} /></div>
    <span className="judge-eyebrow">START HERE · {perspective === "client" ? "CLIENT" : "FREELANCER"} WORKSPACE</span>
    <h1 id="onboarding-title">{guide.title}</h1>
    <p>{guide.description}</p>
    <Link className="buttonlike forest" href={pendingInvitation ? "/invitations" : guide.href}>{pendingInvitation ? "Review invitation" : guide.label} <span aria-hidden="true">→</span></Link>
    {pendingInvitation && <p className="onboard-hint">You have a pending invitation. Review it to join the project.{perspective === "client" && <> Or <Link href={guide.href}>create a project</Link> of your own.</>}</p>}
    {!pendingInvitation && perspective === "freelancer" && <p className="onboard-hint">Ask your client to invite your account email. Invitations appear inside ProofPay.</p>}
    <ol className="onboard-steps" aria-label="Workflow guide, not completed progress">
      {guide.steps.map(([title, description], index) => <li className="onboard-step" key={title}>
        <div className="onboard-step-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
        <strong>{title}</strong><span>{description}</span>
      </li>)}
    </ol>
  </section>;
}

export function WorkflowHelp() {
  return <details className="workflow-help">
    <summary>How ProofPay works</summary>
    <div><p>Agree on milestones together. Submit files and links as evidence. The client reviews the work against the agreement and records a decision.</p>
      <p>This is the real workspace. AI agreement drafts need your review. Automated evidence verification is not connected. Approval does not confirm payment; PayPal Sandbox uses test payments and supports one configured merchant freelancer.</p>
      <Link href="/how-it-works">Read the workflow guide <span aria-hidden="true">↗</span></Link></div>
  </details>;
}
