import {
  ApiError,
  apiErrorResponse,
  authorizeProject,
  readJsonBounded,
} from "@/lib/server/http";
import {
  archiveReasons,
  isArchiveState,
  type ArchiveReason,
} from "@/lib/project-archive";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };
function missing(error: { code?: string }) {
  return ["PGRST202", "42883", "42703"].includes(error.code || "");
}
function rpcFailure(error: { code?: string; message?: string }): never {
  if (missing(error)) throw new ApiError(503, archiveReasons.SETUP_REQUIRED);
  if (error.code === "42501")
    throw new ApiError(
      403,
      "Only the verified project owner can manage its archive.",
    );
  const reason = error.message?.replace(/^ARCHIVE_/, "");
  if (reason && Object.hasOwn(archiveReasons, reason))
    throw new ApiError(409, archiveReasons[reason as ArchiveReason]);
  if (reason === "STALE")
    throw new ApiError(
      409,
      "The project changed. Reload its archive eligibility before continuing.",
    );
  if (reason === "REQUEST_REUSED")
    throw new ApiError(
      409,
      "This request belongs to another action. Close the dialog and try again.",
    );
  throw new ApiError(
    503,
    "Project management could not be checked. Refresh and try again.",
  );
}
async function handle(request: Request, context: Context, mutate: boolean) {
  try {
    const { id } = await context.params;
    const { client, project, user } = await authorizeProject(
      request,
      id,
      "client",
    );
    if (project.created_by !== user.id)
      throw new ApiError(403, "Only the project owner can manage its archive.");
    let name = "get_project_archive_state";
    const args: Record<string, unknown> = { p_project_id: id };
    if (mutate) {
      const body = (await readJsonBounded(request, 1024)) as Record<
        string,
        unknown
      > | null;
      if (
        !body ||
        typeof body.action !== "string" ||
        !["archive", "reopen"].includes(body.action) ||
        typeof body.requestId !== "string" ||
        !uuid.test(body.requestId) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        Number(body.expectedRevision) < 0 ||
        Number(body.expectedRevision) > 2147483646
      )
        throw new ApiError(
          422,
          "Use a valid archive action, request ID and project revision.",
        );
      name = "manage_project_archive";
      Object.assign(args, {
        p_action: body.action,
        p_request_id: body.requestId,
        p_expected_revision: body.expectedRevision,
      });
    }
    const { data, error } = await client.rpc(name, args);
    if (error) {
      if (!mutate && missing(error))
        return Response.json(
          {
            available: false,
            status: project.status,
            revision: 0,
            archivedAt: null,
            canArchive: false,
            canReopen: false,
            reason: "SETUP_REQUIRED",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      rpcFailure(error);
    }
    if (!isArchiveState(data) || (mutate && data.confirmed !== true))
      throw new ApiError(
        503,
        "The archive result could not be confirmed. Retry the same request.",
      );
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
export const GET = (request: Request, context: Context) =>
  handle(request, context, false);
export const POST = (request: Request, context: Context) =>
  handle(request, context, true);
