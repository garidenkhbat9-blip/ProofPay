import { authorizeProject, ApiError, apiErrorResponse } from "@/lib/server/http";
import { reviewSubmissionText } from "@/lib/server/evidence-review";
import { createRequestGate } from "@/lib/request-gate";
import { GeminiError } from "@/lib/gemini";
export const runtime = "nodejs";
export const maxDuration = 120;
const requests = createRequestGate(60000);
export async function POST(request: Request, context: {params: Promise<{id: string; submissionId: string}>}) {
  try {
    // IDs come from the path; do not clone Next's streamed POST body, which
    // requires Node duplex options and can throw before authentication.
    request = new Request(request.url, {method: request.method, headers: request.headers,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(100000)])});
    const {id, submissionId} = await context.params;
    const {client, user} = await authorizeProject(request, id, "client");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) throw new ApiError(404, "Submission not found.");
    const release = requests.claim(user.id);
    if (!release) throw new ApiError(429, "Wait one minute before requesting another evidence analysis.");
    try {
      const report = await reviewSubmissionText(client, id, submissionId, request.signal);
      return Response.json(report, {headers: {"Cache-Control": "no-store"}});
    } finally {release();}
  } catch(error) {
    if (error instanceof GeminiError) console.error("proofpay-gemini", error.diagnostic);
    if (request.signal.aborted) return apiErrorResponse(new ApiError(503, "Evidence analysis was cancelled or timed out. No saved work has changed."));
    const response = apiErrorResponse(error);
    if (response.status === 429) response.headers.set("Retry-After", String(Math.max(60, error instanceof GeminiError ? error.diagnostic.retryAfterSeconds || 0 : 0)));
    return response;
  }
}
