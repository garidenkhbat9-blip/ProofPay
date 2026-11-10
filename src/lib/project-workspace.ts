import {
  activeLink,
  agreementMilestones,
  bothAccepted,
  invitationStatus,
  latestAgreement,
  memberRole,
  revisions,
  reviewable,
} from "./domain";
import type { CloudData, Role } from "./types";

export type ProjectPhase = "setup" | "deliver" | "review" | "payment";
export type PhaseState =
  "complete" | "current" | "waiting" | "blocked" | "not_started";
export const projectPhaseNames = {
  setup: "Agreement",
  deliver: "Delivery",
  review: "Review",
  payment: "Payments",
} as const;
export function projectPhase(value: string | null): ProjectPhase | null {
  return value && Object.hasOwn(projectPhaseNames, value)
    ? (value as ProjectPhase)
    : null;
}
export function workspaceHref(
  id: string,
  phase: ProjectPhase,
  handoff?: string,
) {
  return `/projects/${id}?phase=${phase}${handoff ? `&handoff=${encodeURIComponent(handoff)}` : ""}`;
}
type Action = {
  title: string;
  label: string;
  phase: ProjectPhase;
  href: string;
  actor: string;
  priority: number;
  invite?: boolean;
};

export function projectWorkspace(
  data: CloudData,
  id: string,
  userId?: string,
  now = Date.now(),
) {
  const project = data.projects.find((p) => p.id === id);
  const role = memberRole(data, id, userId);
  if (!project || !role) return null;
  const agreement = latestAgreement(data, id);
  const milestones = agreement ? agreementMilestones(data, agreement.id) : [];
  const freelancer = data.members.find(
    (m) => m.project_id === id && m.role === "freelancer",
  );
  const participants = (r: Role) => {
    const member = data.members.find(
      (m) => m.project_id === id && m.role === r,
    );
    return member
      ? data.profiles.find((p) => p.id === member.user_id)?.full_name ||
          `${r === "client" ? "Client" : "Freelancer"} member`
      : "Not assigned";
  };
  const unavailable = !!(
    data.invitationError ||
    data.agreementError ||
    data.deliveryError
  );
  const archived = project.status === "archived";
  const ready =
    !unavailable &&
    !!freelancer &&
    !!agreement &&
    milestones.length > 0 &&
    bothAccepted(data, agreement.id);
  const action = (
    phase: ProjectPhase,
    title: string,
    label: string,
    actor: string,
    priority = 0,
    handoff?: string,
  ): Action => ({
    phase,
    title,
    label,
    actor,
    priority,
    href: workspaceHref(id, phase, handoff),
  });
  const rows = milestones.map((milestone) => {
    const history = revisions(data, milestone.id);
    const latest = history[0];
    const link = data.links.find(
      (l) =>
        l.project_id === id &&
        l.milestone_id === milestone.id &&
        l.freelancer_id === freelancer?.user_id &&
        activeLink(data, l, now),
    );
    const evidenceLink = data.links.find(
      (l) =>
        l.id === latest?.link_id &&
        l.project_id === id &&
        l.milestone_id === milestone.id,
    );
    const approved = ready && latest?.status === "approved";
    const paid =
      approved &&
      !data.paymentError &&
      data.payments.some(
        (p) =>
          p.project_id === id &&
          p.agreement_id === agreement?.id &&
          p.milestone_id === milestone.id &&
          p.submission_id === latest?.id &&
          p.status === "PAID" &&
          !!p.last_verified_at &&
          p.reconciliation_status === "SYNCED",
      );
    const noPayment = approved && Number(milestone.amount) === 0;
    let status = "Agreement pending";
    let next = action("setup", status, "View agreement", "Both participants");
    if (ready) {
      if (approved) {
        status = data.paymentError
          ? "Approved · payment unavailable"
          : noPayment
            ? "Approved · no payment required"
            : paid
              ? "Paid · Sandbox verified"
              : "Approved · payment unconfirmed";
        next = action(
          "payment",
          status,
          "View payment options",
          paid || noPayment
            ? "No action required"
            : "Assigned freelancer and client",
          paid || noPayment || data.paymentError ? 0 : 30,
        );
      } else if (latest?.status === "submitted") {
        status = "Waiting for client review";
        next =
          evidenceLink && reviewable(data, evidenceLink)
            ? action(
                "review",
                role === "client" ? "Work ready for review" : status,
                role === "client" ? "Review submission" : "View submitted work",
                "Client",
                role === "client" ? 100 : 0,
                evidenceLink.id,
              )
            : action(
                "review",
                "Evidence link unavailable",
                "View review status",
                "Client",
              );
      } else {
        status =
          latest?.status === "changes"
            ? "Changes requested"
            : link
              ? "Ready to deliver"
              : "Delivery access needed";
        if (role === "freelancer" && link && link.freelancer_id === userId)
          next = action(
            "deliver",
            status,
            latest?.status === "changes"
              ? "View feedback"
              : latest?.status === "uploading"
                ? "Resume submission"
                : "Submit your work",
            "Freelancer",
            latest?.status === "changes" ? 100 : 80,
            link.id,
          );
        else if (role === "client" && !link)
          next = action(
            "deliver",
            "Create delivery access",
            "Create submission link",
            "Client",
            80,
          );
        else
          next = action(
            "deliver",
            link ? "Waiting for freelancer" : "Waiting for client access",
            evidenceLink ? "View feedback" : "View delivery",
            link ? "Freelancer" : "Client",
            0,
            evidenceLink?.id,
          );
      }
    }
    if (unavailable || archived) {
      status = unavailable ? "Status unavailable" : "Archived";
      next = action("setup", status, "View records", "No action available");
    }
    return {
      milestone,
      latest,
      history,
      link,
      evidenceLink,
      approved,
      paid,
      noPayment,
      status,
      next,
    };
  });
  const submitted = rows.filter((r) => r.latest?.status === "submitted").length;
  const approved = rows.filter((r) => r.approved).length;
  const paid = rows.filter((r) => r.paid && !r.noPayment).length;
  const settled = rows.filter((r) => r.paid || r.noPayment).length;
  const pendingInvite = data.invitations.some(
    (i) => i.project_id === id && invitationStatus(i, now) === "pending",
  );
  const ownAcceptance = data.approvals.some(
    (a) =>
      a.agreement_id === agreement?.id &&
      a.user_id === userId &&
      a.role === role,
  );
  let primary: Action;
  if (unavailable || archived)
    primary = action(
      "setup",
      unavailable ? "Project status unavailable" : "Project archived",
      "View records",
      "No action available",
    );
  else if (!freelancer)
    primary = pendingInvite
      ? action(
          "setup",
          "Waiting for freelancer",
          "View invitation",
          "Invited freelancer",
        )
      : {
          ...action(
            "setup",
            "Invite a freelancer",
            "Invite",
            "Client",
            role === "client" ? 90 : 0,
          ),
          invite: role === "client",
        };
  else if (!ready)
    primary = action(
      "setup",
      !agreement || !milestones.length
        ? "Agreement needs preparation"
        : ownAcceptance
          ? "Waiting for agreement acceptance"
          : "Review agreement",
      role === "client" && (!agreement || !milestones.length)
        ? "Prepare agreement"
        : "Review agreement",
      !agreement || !milestones.length
        ? "Client"
        : ownAcceptance
          ? role === "client"
            ? "Freelancer"
            : "Client"
          : role === "client"
            ? "Client"
            : "Freelancer",
      !agreement || !milestones.length
        ? role === "client"
          ? 90
          : 0
        : ownAcceptance
          ? 0
          : 90,
    );
  else
    primary =
      [...rows].sort((a, b) => b.next.priority - a.next.priority)[0]?.next ||
      action("setup", "Review project setup", "View agreement", "Client");
  const frozen = unavailable || archived;
  const deliverComplete =
    ready &&
    rows.every((r) =>
      ["submitted", "approved"].includes(r.latest?.status || ""),
    );
  const phases: {
    id: ProjectPhase;
    label: string;
    state: PhaseState;
    detail: string;
  }[] = [
    {
      id: "setup",
      label: "Agreement",
      state: frozen
        ? "blocked"
        : ready
          ? "complete"
          : primary.priority > 0
            ? "current"
            : "waiting",
      detail:
        "Team, milestones and both-party acceptance of the latest agreement.",
    },
    {
      id: "deliver",
      label: "Delivery",
      state:
        frozen || !ready
          ? "blocked"
          : deliverComplete
            ? "complete"
            : rows.some(
                  (r) => r.next.phase === "deliver" && r.next.priority > 0,
                )
              ? "current"
              : "waiting",
      detail:
        "All current milestones must be submitted; requested revisions remain open.",
    },
    {
      id: "review",
      label: "Review",
      state:
        frozen || !ready
          ? "blocked"
          : approved === rows.length
            ? "complete"
            : submitted
              ? role === "client"
                ? "current"
                : "waiting"
              : approved || rows.some(row => row.history.some(s => s.status === "changes"))
                ? "waiting"
                : "not_started",
      detail:
        "AI is advisory. Only human approval completes a milestone review.",
    },
    {
      id: "payment",
      label: "Payments",
      state:
        frozen || !ready || !!data.paymentError
          ? "blocked"
          : settled === rows.length
            ? "complete"
            : rows.some((r) => r.approved && !r.paid && !r.noPayment)
              ? "current"
              : approved
                ? "waiting"
                : "not_started",
      detail:
        data.paymentError ||
        "Verified payments are separate from approvals; zero-value approved milestones need no payment.",
    },
  ];
  return {
    project,
    role,
    agreement,
    participants,
    rows,
    phases,
    primary,
    primaryMilestone: rows.find((row) => row.next === primary)?.milestone,
    ready,
    archived,
    unavailable,
    submitted,
    approved,
    paid,
    settled,
  };
}
