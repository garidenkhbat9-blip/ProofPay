import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, Role } from "./types";
import { ApiError } from "./api-http";

/** Auth-verified identity and user-scoped RLS; perspective is never consulted. */
export async function authorizeMember(client: SupabaseClient, bearer: string, projectId: string, requiredRole?: Role) {
  const { data: auth, error: authError } = await client.auth.getUser(bearer);
  if (
    authError &&
    ((authError.status || 0) >= 500 ||
      authError.name === "AuthRetryableFetchError")
  )
    throw new ApiError(
      503,
      "Authentication could not be reached. Please try again.",
    );
  if (authError || !auth.user)
    throw new ApiError(401, "Your session has expired. Sign in again.");
  if (!auth.user.email_confirmed_at)
    throw new ApiError(403, "Verify your email before continuing.");
  const [membership, project] = await Promise.all([
    client
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    client.from("projects").select("*").eq("id", projectId).maybeSingle(),
  ]);
  if (membership.error || project.error)
    throw new ApiError(
      503,
      "Project access could not be checked. Please try again.",
    );
  if (!membership.data || !project.data)
    throw new ApiError(404, "Project not found.");
  if (requiredRole && membership.data.role !== requiredRole)
    throw new ApiError(
      403,
      `Only the project's ${requiredRole} can perform this action.`,
    );
  return {
    client,
    user: auth.user,
    project: project.data as Project,
    role: membership.data.role as Role,
  };
}
