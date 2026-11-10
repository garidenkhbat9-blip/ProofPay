import { invitationStatus, memberRole } from "./domain";
import { projectWorkspace, workspaceHref } from "./project-workspace";
import type { CloudData, Role } from "./types";

export type WaitingKind =
  | "invitation"
  | "setup"
  | "agreement"
  | "access"
  | "delivery"
  | "review"
  | "revision"
  | "payment";
export interface WaitingItem {
  id: string;
  milestoneId?: string;
  title: string;
  state: string;
  kind: WaitingKind;
  actor: string;
  instruction: string;
  since: string | null;
  sinceLabel: string;
  dateNote: string;
  attention: boolean;
  recordHref: string;
  recordLabel: string;
}
export interface ProjectEvent {
  id: string;
  at: string;
  text: string;
  href: string;
}
const validTime = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value)) ? value : null;
const latestTime = (values: (string | null | undefined)[]) =>
  values
    .map(validTime)
    .filter((s): s is string => !!s)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
const roleName = (role: Role) => (role === "client" ? "Client" : "Freelancer");

export function deliveryDeadline(date: string | null | undefined, now: number) {
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return { note: "No delivery deadline recorded", attention: false };
  const today = new Date(now).toISOString().slice(0, 10);
  const days = (Date.parse(date) - Date.parse(today)) / 86400000;
  return {
    note:
      days < 0
        ? `Delivery overdue · due ${date} (UTC)`
        : days === 0
          ? `Delivery due today · ${date} (UTC)`
          : days <= 3
            ? `Delivery due soon · ${date} (UTC)`
            : `Delivery due ${date} (UTC)`,
    attention: days <= 3,
  };
}

export function projectEvents(
  data: CloudData,
  projectId: string,
  userId?: string,
): ProjectEvent[] {
  if (!memberRole(data, projectId, userId)) return [];
  const agreements = data.agreements.filter((a) => a.project_id === projectId);
  const agreementIds = new Set(agreements.map((a) => a.id));
  const submissions = data.submissions.filter(
    (s) => s.project_id === projectId && s.status !== "uploading",
  );
  const events: ProjectEvent[] = [
    ...(!data.invitationError
      ? data.invitations
          .filter((i) => i.project_id === projectId)
          .map((i) => ({
            id: `invite-${i.id}`,
            at: i.created_at,
            text: "Freelancer invitation created",
            href: workspaceHref(projectId, "setup"),
          }))
      : []),
    ...(!data.agreementError
      ? agreements.map((a) => ({
          id: `agreement-${a.id}`,
          at: a.created_at,
          text: `Agreement v${a.version} created`,
          href: `/projects/${projectId}/agreement?version=${encodeURIComponent(a.id)}`,
        }))
      : []),
    ...(!data.agreementError
      ? data.approvals
          .filter((a) => agreementIds.has(a.agreement_id))
          .map((a) => ({
            id: `accept-${a.agreement_id}-${a.user_id}`,
            at: a.approved_at,
            text: `${roleName(a.role)} accepted agreement v${agreements.find((v) => v.id === a.agreement_id)!.version}`,
            href: `/projects/${projectId}/agreement?version=${encodeURIComponent(a.agreement_id)}`,
          }))
      : []),
    ...(!data.deliveryError
      ? submissions
          .filter((s) => validTime(s.submitted_at))
          .map((s) => ({
            id: `submission-${s.id}`,
            at: s.submitted_at!,
            text: `${data.milestones.find(m=>m.id===s.milestone_id)?.title || "Milestone"} · Revision ${s.revision} received`,
            href: `/handoff/${s.link_id}#revision-${s.revision}`,
          }))
      : []),
    ...(!data.deliveryError
      ? data.reviews.flatMap((r) => {
          const s = submissions.find((s) => s.id === r.submission_id);
          return s
            ? [
                {
                  id: `review-${r.id}`,
                  at: r.created_at,
                  text: `${data.milestones.find(m=>m.id===s.milestone_id)?.title || "Milestone"} · ${r.decision === "approved" ? "Milestone approved" : "Changes requested"} · Revision ${s.revision}`,
                  href: `/handoff/${s.link_id}#revision-${s.revision}`,
                },
              ]
            : [];
        })
      : []),
  ];
  return events
    .filter((e) => validTime(e.at))
    .sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
    );
}

export const reminderAvailability = Object.freeze({
  available: false as const,
  message:
    "Project reminders are not connected. No notification or email will be sent from this panel.",
});

export function projectWaiting(
  data: CloudData,
  projectId: string,
  userId?: string,
  now = Date.now(),
) {
  const model = projectWorkspace(data, projectId, userId, now);
  if (!model) return null;
  const { project, role, agreement, rows } = model;
  const events = projectEvents(data, projectId, userId);
  const items: WaitingItem[] = [];
  const setup = workspaceHref(projectId, "setup");
  const base = {
    id: "setup",
    title: project.title,
    since: null,
    sinceLabel: "Waiting start unavailable",
    dateNote: "No response deadline recorded",
    attention: false,
    recordHref: setup,
    recordLabel: "View agreement",
  };
  const freelancer = data.members.find(
    (m) => m.project_id === projectId && m.role === "freelancer",
  );
  if (!model.archived && !model.unavailable) {
    if (!freelancer) {
      const invite = data.invitations
        .filter(
          (i) =>
            i.project_id === projectId &&
            !!validTime(i.expires_at) &&
            invitationStatus(i, now) === "pending",
        )
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      items.push(
        invite
          ? {
              ...base,
              id: invite.id,
              kind: "invitation",
              state: "Waiting for freelancer to accept",
              actor: "Invited freelancer",
              instruction:
                "Sign in with the invited verified account and accept the invitation.",
              since: validTime(invite.created_at),
              sinceLabel: "Invited",
              dateNote: `Invitation expires ${new Date(invite.expires_at).toISOString().slice(0, 16).replace("T", " ")} (UTC)`,
              recordLabel: "View invitation",
            }
          : {
              ...base,
              kind: "setup",
              state: "Freelancer invitation needed",
              actor: "Client",
              instruction:
                "Invite a freelancer through the existing project invitation flow.",
              recordLabel: "View team setup",
            },
      );
    } else if (!agreement || !rows.length) {
      items.push({
        ...base,
        kind: "setup",
        state: "Waiting for agreement preparation",
        actor: "Client",
        instruction:
          "Prepare milestones and acceptance criteria for both participants to review.",
        since: validTime(agreement?.created_at),
        sinceLabel: "Latest agreement created",
      });
    } else if (!model.ready) {
      const missing = (["client", "freelancer"] as Role[]).filter(
        (r) =>
          !data.approvals.some(
            (a) => a.agreement_id === agreement.id && a.role === r,
          ),
      );
      items.push({
        ...base,
        kind: "agreement",
        state: `Waiting for ${missing.length === 2 ? "both participants" : missing[0]} agreement acceptance`,
        actor: missing.map(roleName).join(" & "),
        instruction: `Review and accept agreement v${agreement.version}. Prior-version acceptance does not carry forward.`,
        since: validTime(agreement.created_at),
        sinceLabel: "Version awaiting acceptance since",
      });
    } else {
      const acceptedAt = latestTime(
        data.approvals
          .filter((a) => a.agreement_id === agreement.id)
          .map((a) => a.approved_at),
      );
      for (const row of rows) {
        const { milestone, latest, link, evidenceLink } = row;
        if (row.paid || row.noPayment) continue;
        const review = data.reviews.find(
          (r) =>
            r.submission_id === latest?.id && r.decision === latest?.status,
        );
        const item = {
          ...base,
          id: milestone.id,
          milestoneId: milestone.id,
          title: milestone.title,
          recordHref: row.next.href,
          recordLabel: row.next.label,
        };
        if (row.approved) {
          items.push({
            ...item,
            kind: "payment",
            state: data.paymentError
              ? "Approved · payment status unavailable"
              : "Approved · payment pending confirmation",
            actor: "Client & assigned freelancer",
            instruction:
              "Check invoice and verified payment status in Payments. Approval is not payment; this is not client-review inactivity.",
            since: validTime(review?.created_at),
            sinceLabel: "Work approved",
            dateNote: "No payment due date available in this workspace",
            recordHref: workspaceHref(projectId, "payment"),
            recordLabel: "View payment status",
          });
        } else if (latest?.status === "submitted") {
          items.push({
            ...item,
            kind: "review",
            state: "Waiting for client review",
            actor: "Client",
            instruction:
              "Inspect the submitted revision and record approval or request changes.",
            since: validTime(latest.submitted_at),
            sinceLabel: "Submission received",
            dateNote: "No contractual review-response deadline recorded",
            recordHref: evidenceLink
              ? workspaceHref(projectId, "review", evidenceLink.id)
              : workspaceHref(projectId, "review"),
            recordLabel:
              role === "client"
                ? "Review submission"
                : "View submission record",
          });
        } else if (!link) {
          items.push({
            ...item,
            kind: "access",
            state: "Waiting for client delivery access",
            actor: "Client",
            instruction:
              "Create an active submission link for the assigned freelancer. An expired link is not evidence of nonresponse.",
            since: acceptedAt,
            sinceLabel: "Agreement accepted",
            recordHref: workspaceHref(projectId, "deliver"),
            recordLabel:
              role === "client"
                ? "Open delivery access"
                : "View delivery records",
          });
        } else if (latest?.status === "changes") {
          items.push({
            ...item,
            kind: "revision",
            state: "Waiting for freelancer revision",
            actor: "Freelancer",
            instruction:
              "Address the saved client feedback and submit a new revision through the active link.",
            since: validTime(review?.created_at),
            sinceLabel: "Changes requested",
            dateNote: `Original delivery date: ${milestone.due_date || "not recorded"}. No separate revision deadline recorded.`,
            recordHref: workspaceHref(projectId, "deliver", link.id),
            recordLabel:
              role === "freelancer"
                ? "Address requested changes"
                : "View feedback",
          });
        } else {
          const deadline = deliveryDeadline(milestone.due_date, now);
          items.push({
            ...item,
            kind: "delivery",
            state: "Waiting for freelancer delivery",
            actor: "Freelancer",
            instruction:
              "Submit work against the accepted milestone through the active submission link.",
            since: latestTime([acceptedAt, link.created_at]),
            sinceLabel: "Delivery ready since",
            dateNote: deadline.note,
            attention: deadline.attention,
            recordHref: workspaceHref(projectId, "deliver", link.id),
            recordLabel:
              role === "freelancer" ? "Submit work" : "View delivery record",
          });
        }
      }
    }
  }
  const ranked = [...rows].sort(
    (a, b) =>
      b.next.priority - a.next.priority ||
      (Date.parse(a.milestone.due_date) || Infinity) -
        (Date.parse(b.milestone.due_date) || Infinity) ||
      a.milestone.position - b.milestone.position ||
      a.milestone.id.localeCompare(b.milestone.id),
  );
  let primary = model.ready ? ranked[0]?.next || model.primary : model.primary;
  const focus =
    items.find((i) => i.milestoneId === ranked[0]?.milestone.id) ||
    [...items].sort((a, b) => Number(b.attention) - Number(a.attention))[0];
  if (!primary.priority && focus && !model.archived && !model.unavailable)
    primary = {
      ...primary,
      title: focus.state,
      actor: focus.actor,
      label: "Resolve delay",
      href: "#project-waiting",
    };
  const hasHistory =
    data.submissions.some((s) => s.project_id === projectId) ||
    data.payments.some((p) => p.project_id === projectId);
  return {
    items,
    events,
    primary,
    focus,
    role,
    archived: model.archived,
    unavailable: model.unavailable,
    hasFreelancer: !!freelancer,
    hasAgreement: !!agreement,
    hasHistory,
    canManageInvitation:
      role === "client" && !freelancer && !model.archived && !model.unavailable,
    setupHref: setup,
    reminders: reminderAvailability,
  };
}
