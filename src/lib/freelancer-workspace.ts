import {
  activeLink,
  agreementMilestones,
  bothAccepted,
  latestAgreement,
  revisions,
} from "./domain";
import { workspaceProjects } from "./project-management";
import { projectNextStep } from "./project-workflow";
import type { CloudData, Project } from "./types";

export function deadlineLabel(date: string | null, now = Date.now()) {
  if (!date || !Number.isFinite(Date.parse(date))) return null;
  const day = new Date(now).toISOString().slice(0, 10);
  const due = date.slice(0, 10);
  if (due < day) return `Past due · ${due}`;
  if (due === day) return "Due today";
  if (Date.parse(due) - Date.parse(day) <= 3 * 86400000)
    return `Due soon · ${due}`;
  return `Due ${due}`;
}

/** Read-only presentation; existing workflow and server guards remain authoritative. */
function freelancerJob(
  data: CloudData,
  project: Project,
  userId: string,
  now = Date.now(),
) {
  const step = projectNextStep(data, project, userId);
  const agreement = latestAgreement(data, project.id);
  const unavailable = !!(
    data.invitationError ||
    data.agreementError ||
    data.deliveryError
  );
  const archived = project.status === "archived";
  const client = data.members.find(
    (m) => m.project_id === project.id && m.role === "client",
  );
  const clientName =
    data.profiles.find((p) => p.id === client?.user_id)?.full_name ||
    "Your client";
  const accepted = !!agreement && bothAccepted(data, agreement.id);
  const milestones = agreement ? agreementMilestones(data, agreement.id) : [];
  // Inspect each latest milestone separately: one item in review must not hide
  // a different milestone the freelancer can still deliver.
  const deliveries =
    !unavailable && !archived && accepted
      ? milestones
          .flatMap((m) => {
            const submission = revisions(data, m.id)[0];
            if (
              submission &&
              ["submitted", "approved"].includes(submission.status)
            )
              return [];
            const link = data.links.find(
              (l) =>
                l.project_id === project.id &&
                l.milestone_id === m.id &&
                l.freelancer_id === userId &&
                activeLink(data, l, now),
            );
            return link ? [{ milestone: m, submission, link }] : [];
          })
          .sort(
            (a, b) =>
              Number(b.submission?.status === "changes") -
                Number(a.submission?.status === "changes") ||
              (Date.parse(a.milestone.due_date) || Infinity) -
                (Date.parse(b.milestone.due_date) || Infinity),
          )
      : [];
  const delivery = deliveries[0];
  const waitingReview =
    !unavailable &&
    !archived &&
    accepted &&
    milestones.some((m) => revisions(data, m.id)[0]?.status === "submitted");
  const paymentAttention =
    !unavailable &&
    !archived &&
    !data.paymentError &&
    step?.stages?.[5]?.state === "current";
  const paid = !data.paymentError && step?.status === "Payment recorded";
  let status = archived ? "Archived" : step?.status || "Status unavailable";
  let actor = unavailable ? "Status unavailable" : "No immediate action";
  let label = step?.label || "View job";
  let href = step?.href || `/projects/${project.id}`;
  let priority = 0;
  if (!archived && !unavailable) {
    if (delivery) {
      status =
        delivery.submission?.status === "changes"
          ? "Changes requested"
          : "Ready to deliver";
      actor = "Your action";
      label =
        delivery.submission?.status === "changes"
          ? "Revise delivery"
          : delivery.submission?.status === "uploading"
            ? "Resume submission"
            : "Submit work";
      href = `/handoff/${delivery.link.id}`;
      priority = delivery.submission?.status === "changes" ? 100 : 80;
    } else if (step?.stage === 1) {
      status = step.attention
        ? "Agreement pending"
        : step.status === "Awaiting acceptance"
          ? "Waiting for client acceptance"
          : "Waiting for client agreement";
      actor = step.attention ? "Your action" : "Client's action";
      priority = step.attention ? 70 : 0;
    } else if (waitingReview) {
      status = "Waiting for client review";
      actor = "Client's action";
    } else if (step?.stage === 2) {
      status =
        step.status === "Changes requested"
          ? "Changes requested · access needed"
          : "Waiting for delivery access";
      actor = "Client's action";
    } else if (paid) status = "Paid · Sandbox verified";
    else if (step?.stage === 5 && paymentAttention) {
      status = "Approved · payment unconfirmed";
      actor = "Check payment records";
      priority = 20;
    }
  }
  const waitingClient =
    !archived && !unavailable && (waitingReview || actor === "Client's action");
  const dueDate = delivery?.milestone.due_date || project.due_date;
  return {
    project,
    step,
    agreement,
    clientName,
    status,
    actor,
    label,
    href,
    priority,
    deliveries,
    waitingClient,
    paymentAttention,
    paid,
    deadline:
      !archived && (delivery || step?.stage === 1 || step?.stage === 2)
        ? deadlineLabel(dueDate, now)
        : null,
    delivery,
    unavailable,
  };
}

export function freelancerWorkspace(
  data: CloudData,
  userId?: string,
  now = Date.now(),
) {
  const jobs = workspaceProjects(data, userId, "freelancer").map((p) =>
    freelancerJob(data, p, userId!, now),
  );
  const active = jobs.filter((j) => j.project.status !== "archived");
  const unavailable = !!(
    data.invitationError ||
    data.agreementError ||
    data.deliveryError
  );
  const ranked = [...active].sort(
    (a, b) =>
      b.priority - a.priority ||
      (Date.parse(a.delivery?.milestone.due_date || "") || Infinity) -
        (Date.parse(b.delivery?.milestone.due_date || "") || Infinity),
  );
  return {
    jobs,
    active,
    next: ranked[0],
    deliveryCount: unavailable
      ? null
      : active.filter((j) => j.deliveries.length > 0).length,
    waitingCount: unavailable
      ? null
      : active.filter((j) => j.waitingClient).length,
    paymentCount:
      unavailable || data.paymentError
        ? null
        : active.filter((j) => j.paymentAttention).length,
  };
}

export type FreelancerJob = ReturnType<typeof freelancerJob>;
