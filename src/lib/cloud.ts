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
  "payments",
] as const;
export async function loadCloud(client: SupabaseClient): Promise<CloudData> {
  const r = await Promise.all(tables.map(async (table) => {
    const rows: Record<string, unknown>[] = [];
    const keys = table === "project_members" ? ["project_id", "user_id"]
      : table === "agreement_approvals" ? ["agreement_id", "role"] : ["id"];
    let total: number | null = null;
    while (rows.length < 10000) {
      const columns: string = table === "payments" ? "id,project_id,milestone_id,agreement_id,submission_id,status,last_verified_at,reconciliation_status" : "*";
      let query = client.from(table).select(columns, { count: "exact" });
      for (const key of keys) query = query.order(key);
      const result = await query.range(rows.length, rows.length + 499);
      if (result.error) return result;
      if (result.count === null || (total !== null && total !== result.count))
        throw Error("Workspace changed while loading. Please refresh.");
      total = result.count;
      const page: unknown = result.data ?? [];
      if (!Array.isArray(page) || page.some(row => !row || typeof row !== "object" || Array.isArray(row)))
        throw Error("The workspace returned invalid records. Please refresh.");
      rows.push(...page);
      if (rows.length === total) return { data: rows, error: null };
      if (!result.data?.length || rows.length > total) break;
    }
    throw Error("The workspace could not be loaded completely. Please refresh or contact support.");
  }));
  for (const [index, result] of r.entries()) {
    if (!result.error) continue;
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
    payments: r[12].data ?? [],
    paymentError: r[12].error ? "Payment status is unavailable. Open Payments to check setup." : "",
    invitationError: r[3].error ? errorMessage(r[3].error) : "",
    agreementError: r.slice(4, 8).some((x) => x.error) ? "Agreement storage is unavailable. Contact the project administrator." : "",
    deliveryError: r.slice(8, 12).some((x) => x.error) ? "Evidence storage is unavailable. Contact the project administrator." : "",
  } as unknown as CloudData;
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
  if (e && typeof e === "object" && "code" in e) {
    const code = String(e.code);
    if (code === "42501") return "This account is not authorized for that action. Check your project membership and email verification.";
    if (["42P01", "PGRST205", "PGRST202"].includes(code)) return "Workspace storage is unavailable. Contact the project administrator.";
    if (["PGRST301", "PGRST303"].includes(code)) return "Your session has expired. Sign in again.";
    if (code !== "P0001") return "The request could not be completed. Refresh and try again.";
  }
  return e && typeof e === "object" && "message" in e
    ? String(e.message)
    : "Something went wrong. Please retry.";
}
