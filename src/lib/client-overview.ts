import { currentDeliveries } from "./domain";
import { workspaceProjects } from "./project-management";
import { projectNextStep, type ProjectNextStep } from "./project-workflow";
import type { CloudData } from "./types";

export function clientOverview(data: CloudData, userId?: string) {
  const projects = workspaceProjects(data, userId, "client");
  const rows = projects.map(project => ({ project, step: projectNextStep(data, project, userId) }));
  const active = rows.filter(row => row.project.status !== "archived");
  const unavailable = !!(data.invitationError || data.agreementError || data.deliveryError);
  const actions = active.filter(row => row.step).sort((a, b) => (b.step?.priority || 0) - (a.step?.priority || 0));
  const review = unavailable ? [] : active.filter(row => row.step?.stage === 3);
  // Only offer the existing text assistant for an actionable current submission
  // with text notes. This does not assert that Gemini is configured or has run.
  const aiReview = review.find(row => currentDeliveries(data, [row.project.id]).some(s => s.status === "submitted" && !!s.notes.trim() && row.step?.href === `/handoff/${s.link_id}`));
  return {
    rows, active, next: actions[0], aiReview,
    metrics: {
      active: active.length,
      review: unavailable ? null : review.length,
      response: unavailable ? null : active.filter(row => row.step?.actor === "Freelancer").length,
      payment: unavailable || data.paymentError ? null : active.filter(row => row.step?.stages?.[5]?.state === "current").length,
    },
  };
}

export function overviewStatus(step: ProjectNextStep | null, archived = false) {
  if (archived) return "Archived";
  if (!step) return "Status unavailable";
  if (step.stage === 3) return "Awaiting review";
  if (step.stage === 0 && !step.attention) return "Waiting for freelancer";
  if (step.stage === 1 && step.status === "Awaiting acceptance") return "Agreement needs acceptance";
  if (step.stage === 5 && step.stages?.[5]?.state === "current") return "Approved · payment unconfirmed";
  return step.status;
}
