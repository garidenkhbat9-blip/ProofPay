import { memberRole } from "./domain";
import { projectTeam } from "./project-management";
import type { CloudData, Project } from "./types";

// Migration 002 allows unaccepted versions before assignment. Acceptance still
// requires a joined freelancer and the latest immutable version on the server.
export function agreementGuidance(
  data: CloudData,
  project: Project,
  userId?: string,
) {
  const role = memberRole(data, project.id, userId);
  const hasFreelancer = data.members.some(
    (m) => m.project_id === project.id && m.role === "freelancer",
  );
  const invitation = projectTeam(data, project.id).invitation;
  const canDraft =
    role === "client" && project.status !== "archived" && !data.agreementError;
  const canInvite = canDraft && !hasFreelancer && !data.invitationError;
  return {
    role,
    hasFreelancer,
    invitation,
    canDraft,
    canInvite,
    teamTitle:
      data.invitationError || invitation === "accepted"
        ? "Refresh the project team before continuing."
        : invitation === "pending"
          ? "Waiting for the freelancer to accept your invitation."
          : "Invite a freelancer to continue.",
    teamDescription: data.invitationError
      ? "Invitation records could not be loaded. Refresh the workspace to check the current team."
      : invitation === "revoked"
        ? "The previous invitation was revoked. It does not assign a freelancer. Send a new invitation from the project team section."
        : invitation === "expired"
          ? "The previous invitation expired. Send a new invitation from the project team section."
          : invitation === "pending"
            ? "The invited freelancer must sign in and accept in Invitations. No invitation email is sent automatically."
            : invitation === "accepted"
              ? "An accepted invitation is recorded, but freelancer membership is not available. Refresh the workspace before continuing."
              : "A freelancer must join before either party can accept the final agreement or start delivery.",
    teamLabel:
      invitation === "pending" || invitation === "accepted"
        ? "View project team"
        : "Invite freelancer",
    teamHref: `/projects/${project.id}#project-team`,
  };
}
