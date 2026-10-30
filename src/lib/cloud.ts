import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudData } from "./types";
const tables = [
  "projects",
  "project_members",
  "profiles",
  "project_invitations",
  "agreements",
  "milestones",
  "acceptance_criteria",
  "agreement_approvals",
  "submission_links",
  "evidence_submissions",
  "evidence_artifacts",
  "submission_reviews",
] as const;
export async function loadCloud(client: SupabaseClient): Promise<CloudData> {
  const r = await Promise.all(tables.map((t) => client.from(t).select("*")));
  for (const [index, result] of r.entries()) {
    if (!result.error) continue;
    // Only absent optional schema is degradable. A network/permission failure
    // must not replace a previously loaded workflow with partial empty arrays.
    if (index < 3 || !["42P01", "PGRST205"].includes(result.error.code))
      throw result.error;
  }
  return {
    projects: r[0].data ?? [],
    members: r[1].data ?? [],
    profiles: r[2].data ?? [],
    invitations: r[3].data ?? [],
    agreements: r[4].data ?? [],
    milestones: r[5].data ?? [],
    criteria: r[6].data ?? [],
    approvals: r[7].data ?? [],
    links: r[8].data ?? [],
    submissions: r[9].data ?? [],
    artifacts: r[10].data ?? [],
    reviews: r[11].data ?? [],
    invitationError: r[3].error?.message ?? "",
    agreementError: r.slice(4, 8).find((x) => x.error)?.error?.message ?? "",
    deliveryError: r.slice(8).find((x) => x.error)?.error?.message ?? "",
  };
}
export async function rpc<T = string>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export function errorMessage(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String(e.message)
    : "Something went wrong. Please retry.";
}
