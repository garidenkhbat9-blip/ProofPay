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
export function projectNextStep(
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
    const pending = data.invitations.some(
      (i) => i.project_id === project.id && invitationStatus(i) === "pending",
    );
    return step({
      stage: 0,
      status: pending ? "Invitation pending" : "Freelancer needed",
      title: pending
        ? "Waiting for your freelancer to join"
        : "Choose who will deliver the work",
      description: pending
        ? "Ask the freelancer to sign in with the invited email and open Invitations. Invitation emails are not sent automatically."
        : "Invite a freelancer before both parties can accept an agreement.",
      label: pending ? "View invitation" : "Invite freelancer",
      href: base + "#project-team",
      action: pending ? undefined : "invite",
      attention: !pending,
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
      label: role === "client" ? "Create agreement" : "View agreement",
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
  const milestones = agreementMilestones(data, agreement.id);
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
      description: `${submitted.milestone.title} · Revision ${submitted.submission.revision}. Automated verification is not connected; the client must inspect the evidence against the agreement.`,
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
              ? "The freelancer can now submit work"
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
      stage: 4,
      status: "Approved · check payment status",
      title: "Work accepted. Payment remains a separate step.",
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
