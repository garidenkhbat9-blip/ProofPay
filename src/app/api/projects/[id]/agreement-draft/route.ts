import {
  ApiError,
  apiErrorResponse,
  authorizeProject,
  readJsonBounded,
} from "@/lib/server/http";
import { generateAgreementDraft } from "@/lib/server/gemini-agreement";
import { createRequestGate } from "@/lib/request-gate";
import { GeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;
const requests = createRequestGate(30000);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { project, user } = await authorizeProject(request, id, "client");
    if (project.status === "archived")
      throw new ApiError(
        409,
        "Archived projects cannot create new agreement drafts.",
      );
    if (project.work_category !== "website")
      throw new ApiError(
        422,
        "AI drafting is currently available for website projects.",
      );
    const body = await readJsonBounded(request, 45000);
    const scope =
      body && typeof body === "object" && "scope" in body
        ? body.scope
        : undefined;
    if (typeof scope !== "string" || !scope.trim() || scope.length > 10000)
      throw new ApiError(
        422,
        "Enter a scope of work with up to 10,000 characters.",
      );
    const release = requests.claim(user.id);
    if (!release)
      throw new ApiError(
        429,
        "An AI draft was just requested. Wait 30 seconds before trying again.",
      );
    try {
      const result = await generateAgreementDraft(
        project,
        scope.trim(),
        request.signal,
      );
      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      release();
    }
  } catch (error) {
    if (error instanceof GeminiError) console.error("proofpay-gemini", error.diagnostic);
    const response = apiErrorResponse(error);
    if (response.status === 429 && error instanceof GeminiError && error.diagnostic.retryAfterSeconds)
      response.headers.set("Retry-After", String(Math.max(30, error.diagnostic.retryAfterSeconds)));
    return response;
  }
}
