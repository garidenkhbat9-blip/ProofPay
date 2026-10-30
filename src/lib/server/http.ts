import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Project, Role } from "../types";
import { ApiError } from "../api-http";
export { ApiError, apiErrorResponse, readJsonBounded } from "../api-http";

/** Validate the bearer token with Auth, then query with that user's RLS context. */
export async function authorizeProject(
  request: Request,
  projectId: string,
  requiredRole?: Role,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId,
    )
  )
    throw new ApiError(404, "Project not found.");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "Use the application to make this request.");
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) throw new ApiError(401, "Sign in to continue.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError(503, "Authentication is not configured.");
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${bearer}` },
      fetch: (input, options = {}) =>
        fetch(input, {
          ...options,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        }),
    },
  });
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
