import type { User } from "@supabase/supabase-js";
import type { CloudData, Profile, Role } from "./types";
import { invitationStatus, memberRole } from "./domain";
import { projectNextStep } from "./project-workflow";
import { workspaceProjects } from "./project-management";

type WorkspaceUser = Pick<User, "id" | "email" | "user_metadata">;

export function workspaceIdentity(user: WorkspaceUser | null, profiles: Profile[]) {
  const cleanName = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  const name = cleanName(profiles.find((p) => p.id === user?.id)?.full_name) || cleanName(user?.user_metadata.full_name);
  return {
    displayName: name || "Your account",
    initials: name ? name.split(" ").slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase() : "PP",
    // The greeting stays neutral; the separate guided tour owns first-visit state.
    greeting: "Welcome to ProofPay",
  };
}

export const onboarding = {
  client: {
    title: "Welcome to ProofPay.",
    description: "Start with a project, invite your freelancer, and agree on what success looks like.",
    label: "Create your first project",
    href: "/projects/new",
    subtitle: "Set up your first project and experience a clear, evidence-backed workflow.",
    steps: [
      ["Create a project", "Define the brief and planned budget."],
      ["Invite a freelancer", "Invite by email inside ProofPay."],
      ["Agree on milestones", "Both parties accept the same agreement version."],
      ["Review delivered work", "Inspect the evidence and record your decision."],
    ],
  },
  freelancer: {
    title: "Your workspace is ready.",
    description: "Once you're invited to a project, you can review the agreement, deliver work, and track approvals.",
    label: "Check invitations",
    href: "/invitations",
    subtitle: "Join your project and follow a clear path from agreement to delivery.",
    steps: [
      ["Accept an invitation", "Use the email your client invited."],
      ["Agree on project scope", "Confirm scope, milestones and acceptance criteria."],
      ["Submit evidence", "Use your assigned delivery link for files and URLs."],
      ["Follow review and payment status", "Approval and PayPal Sandbox payment are separate."],
    ],
  },
} as const;

export function dashboardGuidance(data: CloudData, user: WorkspaceUser | null, perspective: Role) {
  const projects = workspaceProjects(data, user?.id, perspective);
  const actions = projects.flatMap((project) => {
    const step = projectNextStep(data, project, user?.id);
    return step && project.status !== "archived" ? [{ project, step }] : [];
  }).sort((a, b) => (b.step.priority || 0) - (a.step.priority || 0));
  const email = user?.email?.trim().toLowerCase();
  const pendingInvitation = !data.invitationError && !!email && data.invitations.some((i) => i.invited_email.toLowerCase() === email && invitationStatus(i) === "pending");
  const otherPerspective: Role = perspective === "client" ? "freelancer" : "client";
  const otherProjects = data.projects.filter((p) => memberRole(data, p.id, user?.id) === otherPerspective);
  return { projects, actions, pendingInvitation, otherPerspective, otherProjects, onboarding: onboarding[perspective] };
}
