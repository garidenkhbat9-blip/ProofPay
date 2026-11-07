import type { SupabaseClient } from "@supabase/supabase-js";

export const archiveReasons = {
  SETUP_REQUIRED:
    "Archive is blocked pending owner approval and deployment of the project archive migration.",
  PAYMENT_HISTORY:
    "This project has payment or invoice history. Archiving is not supported for financially active or historical projects.",
  DELIVERY_HISTORY:
    "This project has delivery links or submitted work. Keep it open so evidence and review workflows remain available.",
  AGREEMENT_ACCEPTED:
    "An agreement has already been accepted. Archiving cannot interrupt those obligations.",
  COLLABORATION_ACTIVE:
    "A freelancer has joined or this project is active. Shared projects cannot be archived with the current rules.",
  INVITATION_PENDING:
    "Revoke the pending invitation in the project team section before archiving.",
  LEGACY_ARCHIVE:
    "This project was archived outside this workflow. An administrator must review it before reopening.",
} as const;
export type ArchiveReason = keyof typeof archiveReasons;
export type ArchiveAction = "archive" | "reopen";
export interface ArchiveState {
  available: boolean;
  status: "draft" | "active" | "archived";
  revision: number;
  archivedAt: string | null;
  canArchive: boolean;
  canReopen: boolean;
  reason: ArchiveReason | null;
  confirmed?: boolean;
  replayed?: boolean;
}
export function isArchiveState(value: unknown): value is ArchiveState {
  if (!value || typeof value !== "object") return false;
  const v = value as ArchiveState;
  return (
    typeof v.available === "boolean" &&
    ["draft", "active", "archived"].includes(v.status) &&
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    typeof v.canArchive === "boolean" &&
    typeof v.canReopen === "boolean" &&
    (v.archivedAt === null || typeof v.archivedAt === "string") &&
    (v.reason === null || Object.hasOwn(archiveReasons, v.reason))
  );
}
export async function archiveRequest(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  mutation?: {
    action: ArchiveAction;
    requestId: string;
    expectedRevision: number;
  },
): Promise<ArchiveState> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId)
    throw Error("Your account changed. Refresh and sign in again.");
  const response = await fetch(`/api/projects/${projectId}/archive`, {
    method: mutation ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(mutation ? { "Content-Type": "application/json" } : {}),
    },
    ...(mutation ? { body: JSON.stringify(mutation) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      result?.error?.message ||
        "Project management is unavailable. Refresh and try again.",
    );
  if (!isArchiveState(result) || (mutation && result.confirmed !== true))
    throw Error(
      "The action could not be confirmed. Retry to check the same request.",
    );
  return result;
}
