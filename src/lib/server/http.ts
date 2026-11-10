import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "../types";
import { authorizeMember } from "../project-authorization";
import { ApiError } from "../api-http";
export { ApiError, apiErrorResponse, readJsonBounded } from "../api-http";

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
  return authorizeMember(client, bearer, projectId, requiredRole);
}
