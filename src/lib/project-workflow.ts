import {
  activeLink,
  agreementMilestones,
  bothAccepted,
  invitationStatus,
  latestAgreement,
  memberRole,
  revisions,
} from "./domain";
import type { CloudData, Project } from "./types";

export interface ProjectNextStep {
  stage: number;
  status: string;
  title: string;
  description: string;
  label: string;
  href: string;
  action?: "invite";
  attention: boolean;
  actor?: string;
  blocker?: string;
  priority?: number;
  stages?: WorkflowStage[];
}
export interface WorkflowStage {
  label: string;
  state: "complete" | "current" | "blocked" | "not_started";
  detail: string;
}
export const projectStages = [
  "Team",
  "Agreement",
  "Delivery",
  "Review",
  "Approval",
  "Payment",
];

// A perspective toggle never grants permission. The project membership is authoritative.
function nextAction(
  data: CloudData,
  project: Project,
  userId?: string,
): ProjectNextStep | null {
  const role = memberRole(data, project.id, userId);
  if (!role) return null;
  const base = `/projects/${project.id}`;
  const step = (
    value: Omit<ProjectNextStep, "attention"> & { attention?: boolean },
  ): ProjectNextStep => ({ attention: false, ...value });
  if (project.status === "archived")
    return step({
      stage: -1,
      status: "Archived",
      title: "Project archived",
      description:
        "Past agreements, deliveries and decisions remain available.",
      label: "View records",
      href: base + "/delivery",
    });
  if (data.invitationError || data.agreementError || data.deliveryError)
    return step({
      stage: -1,
      status: "Status unavailable",
      title: "Project records need attention",
      description:
        "Some records could not be loaded. Refresh before taking the next action.",
      label: "View project",
      href: base,
    });
  const freelancer = data.members.find(
    (m) => m.project_id === project.id && m.role === "freelancer",
  );
  if (!freelancer) {
    if (
      data.invitations.some(
        (i) => i.project_id === project.id && i.status === "accepted",
      )
    )
      return step({
        stage: -1,
        status: "Membership unavailable",
        title: "Refresh the project team before continuing.",
        description:
          "An accepted invitation is recorded, but freelancer membership is unavailable. Refresh the workspace to check the current assignment.",
        label: "View project team",
        href: base + "#project-team",
      });
    const pending = data.invitations.some(
      (i) => i.project_id === project.id && invitationStatus(i) === "pending",
    );
    return step({
      stage: 0,
      status: pending ? "Invitation pending" : "Freelancer needed",
      title: pending
        ? "Waiting for the freelancer to accept your invitation."
        : "Invite a freelancer to continue.",
      description: pending
        ? "Ask the freelancer to sign in with the invited email and open Invitations. Invitation emails are not sent automatically."
        : "You can prepare an agreement draft now. A freelancer must join before either party can accept it or delivery can begin.",
      label: pending ? "View invitation" : "Invite freelancer",
      href: base + "#project-team",
      action: !pending && role === "client" ? "invite" : undefined,
      attention: !pending && role === "client",
    });
  }
  const agreement = latestAgreement(data, project.id);
  if (!agreement)
    return step({
      stage: 1,
      status: "Agreement needed",
      title:
        role === "client"
          ? "Define what a complete delivery looks like"
          : "Waiting for the client’s agreement",
      description:
        "Agree on a milestone, its value, deliverables and measurable acceptance criteria.",
      label: role === "client" ? "Create agreement draft" : "View agreement",
      href: base + "/agreement",
      attention: role === "client",
    });
  const milestones = agreementMilestones(data, agreement.id);
  if (!milestones.length)
    return step({
      stage: 1,
      status: "Milestones needed",
      title: "Add at least one milestone before delivery can begin.",
      description:
        role === "client"
          ? "Create a new agreement version with deliverables, amounts and acceptance criteria. Both parties must accept that version."
          : "The client must add milestones in a new agreement version before you can deliver work.",
      label: role === "client" ? "Add milestones" : "View agreement",
      href: base + "/agreement",
      attention: role === "client",
    });
  if (!bothAccepted(data, agreement.id)) {
    const accepted = data.approvals.some(
      (a) => a.agreement_id === agreement.id && a.user_id === userId,
    );
    return step({
      stage: 1,
      status: "Awaiting acceptance",
      title: accepted
        ? "Waiting for the other party to accept"
        : `Review agreement v${agreement.version}`,
      description: accepted
        ? "Your acceptance is recorded. Delivery starts after both parties accept this version."
        : "Read the scope and each acceptance criterion before accepting. A new version needs fresh acceptance.",
      label: accepted ? "View agreement" : "Review & accept agreement",
      href: base + "/agreement",
      attention: !accepted,
    });
  }
  const current = milestones.map((m) => ({
    milestone: m,
    submission: revisions(data, m.id)[0],
  }));
  const submitted = current.find(
    (item) => item.submission?.status === "submitted",
  );
  if (submitted?.submission)
    return step({
      stage: 3,
      status: "Awaiting human review",
      title:
        role === "client"
          ? "Review the latest evidence"
          : "Waiting for the client’s decision",
      description: `${submitted.milestone.title} · Revision ${submitted.submission.revision}. Automated website verification is not connected; the client must inspect the evidence against the agreement.`,
      label: role === "client" ? "Review & approve" : "View submitted work",
      href: "/handoff/" + submitted.submission.link_id,
      attention: role === "client",
    });
  const next =
    current.find((item) => item.submission?.status === "changes") ||
    current.find((item) => item.submission?.status !== "approved");
  if (next) {
    const link = data.links.find(
      (l) =>
        l.milestone_id === next.milestone.id &&
        l.freelancer_id === freelancer.user_id &&
        activeLink(data, l),
    );
    const changes = next.submission?.status === "changes";
    return step({
      stage: 2,
      status: changes ? "Changes requested" : "In progress",
      title:
        role === "freelancer"
          ? changes
            ? "Update the work and submit a new revision"
            : "Deliver the agreed milestone"
          : changes
            ? "Waiting for a revised delivery"
            : link
              ? "Waiting for the freelancer to submit work."
              : "Create the submission link",
      description: link
        ? `${next.milestone.title}. ${changes ? "Previous evidence and client feedback remain in the revision history." : "Deliver the project URL, files and notes through the assigned handoff."}`
        : "A current submission link is required. The client creates it for the assigned freelancer.",
      label:
        role === "client"
          ? link
            ? "View handoff"
            : "Create submission link"
          : link
            ? changes
              ? "Fix & resubmit"
              : next.submission?.status === "uploading"
                ? "Resume submission"
                : "Submit work"
            : "View delivery status",
      href: link ? "/handoff/" + link.id : base + "/delivery",
      attention: role === "client" ? !link : !!link,
    });
  }
  if (
    current.length &&
    current.every((item) => item.submission?.status === "approved")
  )
    return step({
      stage: 5,
      status: "Approved · check payment status",
      title: "Work approved. Payment is a separate step.",
      description:
        "Open payment history to check invoices and verified PayPal Sandbox status. Work approval alone does not confirm a payment.",
      label: "View payment status",
      href: "/payments",
    });
  return step({
    stage: 1,
    status: "Milestones needed",
    title: "Review the agreement milestones",
    description:
      "The current agreement needs a milestone before work can be delivered.",
    label: "View agreement",
    href: base + "/agreement",
    attention: role === "client",
  });
}

// States are derived separately: a review for one milestone does not mean
// every delivery or payment in the project has been completed.
export function projectNextStep(
  data: CloudData,
  project: Project,
  userId?: string,
): ProjectNextStep | null {
  const step = nextAction(data, project, userId);
  if (!step) return null;
  const team = data.members.some(
    (m) => m.project_id === project.id && m.role === "freelancer",
  );
  const agreement = latestAgreement(data, project.id);
  const milestones = agreement ? agreementMilestones(data, agreement.id) : [];
  const accepted =
    team &&
    !!agreement &&
    milestones.length > 0 &&
    bothAccepted(data, agreement.id);
  const latest = milestones.map((m) => ({
    milestone: m,
    submission: revisions(data, m.id)[0],
  }));
  const delivered =
    accepted &&
    latest.every(
      ({ submission: s }) => s && ["submitted", "approved"].includes(s.status),
    );
  const reviewed =
    accepted && latest.every(({ submission: s }) => s?.status === "approved");
  const anyReview =
    accepted && latest.some(({ submission: s }) => s?.status === "submitted");
  const anyApproval =
    accepted && latest.some(({ submission: s }) => s?.status === "approved");
  const paid =
    reviewed &&
    !data.paymentError &&
    latest.every(
      ({ milestone: m, submission: s }) =>
        Number(m.amount) === 0 ||
        data.payments.some(
          (p) =>
            p.project_id === project.id &&
            p.agreement_id === agreement?.id &&
            p.milestone_id === m.id &&
            p.submission_id === s?.id &&
            p.status === "PAID" &&
            !!p.last_verified_at &&
            p.reconciliation_status === "SYNCED",
        ),
    );
  const paused = step.stage < 0;
  const stage = (
    index: number,
    complete: boolean,
    ready: boolean,
    active: boolean,
    detail: string,
  ): WorkflowStage => ({
    label: projectStages[index],
    detail,
    state: paused
      ? "blocked"
      : complete
        ? "complete"
        : !ready
          ? "blocked"
          : active || step.stage === index
            ? "current"
            : "not_started",
  });
  const stages = [
    stage(
      0,
      team,
      true,
      !team,
      team
        ? "Freelancer membership confirmed."
        : "A freelancer must accept a valid invitation.",
    ),
    stage(
      1,
      accepted,
      team,
      team && !accepted,
      "The latest version needs milestones and acceptance from both participants.",
    ),
    stage(
      2,
      delivered,
      accepted,
      accepted && !delivered,
      "The freelancer submits each milestone through a current delivery link.",
    ),
    stage(
      3,
      reviewed,
      accepted && (delivered || anyReview || anyApproval),
      anyReview,
      "The client reviews each submitted revision against its criteria.",
    ),
    stage(
      4,
      reviewed,
      accepted && (delivered || anyApproval),
      false,
      "Client approval records acceptance of work, not payment.",
    ),
    stage(
      5,
      paid,
      anyApproval && !data.paymentError,
      anyApproval && !paid,
      data.paymentError ||
        "Only verified PayPal records confirm payment. Zero-value milestones require no payment.",
    ),
  ];
  if (reviewed && !paused) {
    if (paid)
      Object.assign(step, {
        status: milestones.every((m) => Number(m.amount) === 0)
          ? "No payment required"
          : "Payment recorded",
        title: milestones.every((m) => Number(m.amount) === 0)
          ? "Work approved. No payment is required."
          : "Work approved and Sandbox payment recorded.",
        description:
          "Review the retained agreements, evidence and payment history. No new financial action is needed.",
        attention: false,
      });
    else if (data.paymentError)
      Object.assign(step, {
        status: "Payment status unavailable",
        description: data.paymentError,
        attention: false,
      });
  }
  const pending = data.invitations.some(
    (i) => i.project_id === project.id && invitationStatus(i) === "pending",
  );
  const acceptanceActors = (["client", "freelancer"] as const)
    .filter(role => !data.approvals.some(a => a.agreement_id === agreement?.id && a.role === role))
    .map(role => role === "client" ? "Client" : "Freelancer")
    .join(" and ");
  const actor =
    step.stage < 0
      ? "No action available"
      : step.stage === 0
        ? pending
          ? "Freelancer"
          : "Client"
        : step.stage === 1
          ? !agreement || !milestones.length
            ? "Client"
            : acceptanceActors || "Both participants"
          : step.stage === 2
            ? step.label === "Create submission link" ||
              step.label === "View delivery status"
              ? "Client"
              : "Freelancer"
            : step.stage === 3 || step.stage === 4
              ? "Client"
              : paid
                ? "No action required"
                : "Assigned freelancer and client";
  const blocker = paused
    ? "Workflow changes are unavailable until the project is reopened or its records can be loaded."
    : !team
      ? "Agreement acceptance and delivery wait until a freelancer joins."
      : !accepted
        ? "Delivery waits for milestones and both parties' acceptance of the latest version."
        : !reviewed
          ? "Payment requires a separately approved milestone; unfinished work remains open."
          : paid
            ? ""
            : "Approval does not authorize or confirm payment. Check the recorded invoice status separately.";
  return {
    ...step,
    stages,
    actor,
    blocker,
    priority: step.attention
      ? { 3: 100, 2: 80, 1: 60, 0: 50 }[step.stage] || 40
      : 0,
  };
}
