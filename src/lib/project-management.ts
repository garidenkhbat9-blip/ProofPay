import { invitationStatus, memberRole } from "./domain";
import type { CloudData, Project, Role } from "./types";

export function workspaceProjects(
  data: CloudData,
  userId: string | undefined,
  role: Role,
) {
  return data.projects
    .filter((project) => memberRole(data, project.id, userId) === role)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    );
}

export function projectTeam(data: CloudData, projectId: string) {
  const member = data.members.find(
    (m) => m.project_id === projectId && m.role === "freelancer",
  );
  const invites = data.invitations
    .filter((i) => i.project_id === projectId)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    );
  const pending = invites.find((i) => invitationStatus(i) === "pending");
  const latest = pending || invites[0];
  return {
    freelancer: member
      ? data.profiles.find((p) => p.id === member.user_id)?.full_name ||
        "Assigned freelancer"
      : "Not assigned",
    invitation: data.invitationError
      ? "Unavailable"
      : latest
        ? invitationStatus(latest)
        : "Not sent",
  };
}

export function projectTotals(projects: Project[]) {
  const active = projects.filter((project) => project.status !== "archived");
  return {
    active: active.length,
    archived: projects.length - active.length,
    plannedBudget: active.reduce(
      (sum, project) => sum + Number(project.budget_amount),
      0,
    ),
  };
}
