import {
  memberRole,
  latestAgreement,
  bothAccepted,
  currentDeliveries,
} from "./domain";
import type { CloudData, Role } from "./types";

export function judgeRole(value: unknown): Role | null {
  return value === "client" || value === "freelancer" ? value : null;
}

export function judgeDestination(role: Role) {
  return `/dashboard?perspective=${role}`;
}

export function entryPerspective(destination: string): Role | null {
  const [path, query] = destination.split("?");
  if (path !== "/dashboard" && path !== "/judge-workspace") return null;
  const values = new URLSearchParams(query).getAll("perspective");
  return values.length === 1 ? judgeRole(values[0]) : null;
}

export function legacyJudgeDestination(value: unknown) {
  const role = judgeRole(value);
  return role ? judgeDestination(role) : "/dashboard";
}

// This is a presentation allowlist, never an authorization mechanism.
// Supabase membership and RLS still decide which records can be read or changed.
export function judgeProjectIds(value: string | undefined): string[] {
  const ids =
    value
      ?.split(",")
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean) || [];
  if (
    ids.some(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          id,
        ),
    )
  )
    return [];
  return [...new Set(ids)];
}

export function judgeProjects(
  data: CloudData,
  ids: string[],
  userId: string | undefined,
  role: Role,
) {
  return data.projects.filter(
    (project) =>
      ids.includes(project.id) && memberRole(data, project.id, userId) === role,
  );
}

export function judgeProgress(data: CloudData, projectId: string) {
  const agreement = latestAgreement(data, projectId);
  const milestones = data.milestones.filter(
    (m) => m.agreement_id === agreement?.id,
  );
  const deliveries = currentDeliveries(data, [projectId]);
  const submitted = deliveries.filter((s) => s.status !== "uploading").length;
  const approved = deliveries.filter((s) => s.status === "approved").length;
  return {
    agreement: data.agreementError
      ? "Status unavailable"
      : !agreement
        ? "Not created"
        : `v${agreement.version} · ${bothAccepted(data, agreement.id) ? "Accepted by both parties" : "Awaiting acceptance"}`,
    evidence:
      data.agreementError || data.deliveryError
        ? "Status unavailable"
        : `${submitted} of ${milestones.length} milestones submitted`,
    review:
      data.agreementError || data.deliveryError
        ? "Status unavailable"
        : `${approved} of ${milestones.length} milestones approved`,
  };
}
