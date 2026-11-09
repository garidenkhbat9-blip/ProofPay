import { ApiError, readJsonBounded } from "./api-http";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export interface GeminiDiagnostic {
  kind: "TIMEOUT" | "CANCELLED" | "NETWORK" | "PROVIDER" | "INVALID_OUTPUT" | "SAFETY";
  phase: "headers" | "body" | "parse";
  model: string; requestBytes: number; elapsedMs: number;
  httpStatus?: number; providerStatus?: string; retryAfterSeconds?: number;
  networkCode?: string;
  providerReason?: string;
}
export class GeminiError extends ApiError {
  constructor(status: number, message: string, public readonly diagnostic: GeminiDiagnostic) { super(status, message); }
}
/** Server callers supply configuration; no credentials are bundled here. */
export async function generateStructured<T>(options: {
  key?: string; model?: string; system: string; brief: string; schema: unknown;
  parse: (value: unknown) => T; signal: AbortSignal; maxOutputTokens?: number;
}, transport: typeof fetch = fetch) {
  const model = options.model || DEFAULT_GEMINI_MODEL;
  if (!options.key || !/^gemini-[a-zA-Z0-9.-]+$/.test(model))
    throw new ApiError(503, "AI is not configured correctly. Continue manually or contact the administrator.");
  const maxOutputTokens = options.maxOutputTokens ?? 6000;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 6000)
    throw new ApiError(503, "AI output limits are not configured correctly.");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: options.system }] },
    contents: [{ role: "user", parts: [{ text: options.brief }] }],
    generationConfig: { maxOutputTokens, responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: options.schema } } },
  });
  const requestBytes = new TextEncoder().encode(body).byteLength;
  if (requestBytes > 512000) throw new ApiError(413, "AI input exceeds supported limits.");
  const started = Date.now();
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(45000)]);
  const diagnostic = (kind: GeminiDiagnostic["kind"], phase: GeminiDiagnostic["phase"]): GeminiDiagnostic =>
    ({kind, phase, model, requestBytes, elapsedMs: Date.now() - started});
  const unavailable = (phase: GeminiDiagnostic["phase"], error?: unknown) => {
    const kind = options.signal.aborted ? "CANCELLED" : signal.aborted || (error instanceof Error && error.name === "TimeoutError") ? "TIMEOUT" : "NETWORK";
    const code = (error as {cause?: {code?: string}} | undefined)?.cause?.code;
    return new GeminiError(503, kind === "TIMEOUT" ? "AI analysis reached its time limit. No result was produced; your work is unchanged. Try again later or continue manually."
      : kind === "CANCELLED" ? "AI analysis was cancelled. Your work is unchanged."
      : "The server could not reach Gemini. No result was produced. Try again later or continue manually.",
      {...diagnostic(kind, phase), ...(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code || "") ? {networkCode: code} : {})});
  };
  let response: Response;
  try {
    signal.throwIfAborted();
    response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": options.key },
      cache: "no-store", redirect: "error", signal,
      body,
    });
  } catch (error) { throw unavailable("headers", error); }
  if (!response.ok) {
    // Whitelist provider enums only. Never expose raw message/details, prompts,
    // response text, URLs, credentials or quota project identifiers.
    let providerStatus: string | undefined;
    let providerReason: string | undefined;
    try {
      const error = await readJsonBounded(response, 16000) as {error?: {status?: string; details?: {reason?: string}[]}};
      if (["RESOURCE_EXHAUSTED", "INVALID_ARGUMENT", "PERMISSION_DENIED", "NOT_FOUND", "UNAVAILABLE", "INTERNAL", "UNAUTHENTICATED", "DEADLINE_EXCEEDED"].includes(error?.error?.status || "")) providerStatus = error.error!.status;
      if (Array.isArray(error?.error?.details)) providerReason = error.error.details.find(d => ["API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "SERVICE_DISABLED"].includes(d?.reason || ""))?.reason;
    } catch { /* The HTTP status remains authoritative even if diagnostics fail. */ }
    const retry = Number(response.headers.get("retry-after"));
    throw new GeminiError(response.status === 429 ? 429 : 503,
      providerReason === "API_KEY_INVALID" || providerReason === "API_KEY_EXPIRED" ? "Gemini rejected the server API key. Ask the administrator to update GEMINI_API_KEY and redeploy."
      : response.status === 429 ? "Gemini's request or quota limit was reached. Wait before retrying; manual review remains available."
      : response.status === 401 || response.status === 403 ? "Gemini denied access. Ask the administrator to check the server key and model permissions."
      : response.status === 404 ? "The configured Gemini model or endpoint is unavailable. Ask the administrator to check the model setting."
      : response.status === 400 ? "Gemini rejected the request. Ask the administrator to check the request configuration. Your work is unchanged."
      : response.status === 503 ? "Gemini returned a temporary service-unavailable response. Try again later or continue manually."
      : "Gemini returned a provider error. Try again later or continue manually.",
      {...diagnostic("PROVIDER", "headers"), httpStatus: response.status, providerStatus, providerReason,
        ...(Number.isInteger(retry) && retry > 0 && retry <= 3600 ? {retryAfterSeconds: retry} : {})});
  }
  let phase: GeminiDiagnostic["phase"] = "body";
  try {
    const body = await readJsonBounded(response, 128000) as {
      promptFeedback?: { blockReason?: string };
      candidates?: { finishReason?: string; content?: {parts?: {text?: string; thought?: boolean}[]} }[];
    };
    phase = "parse";
    const candidate = body.candidates?.[0];
    if (body.promptFeedback?.blockReason || ["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION"].includes(candidate?.finishReason || ""))
      throw new GeminiError(422, "Gemini could not analyze this content under its content safeguards. Review the evidence manually; no findings were generated.", diagnostic("SAFETY", "parse"));
    if (candidate?.finishReason !== "STOP") throw Error("Incomplete generation");
    const text = candidate.content?.parts?.filter(p => !p.thought).map(p => p.text || "").join("");
    if (!text || text.length > 50000) throw Error("Invalid result size");
    return { result: options.parse(JSON.parse(text)), model };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (signal.aborted) throw unavailable(phase);
    if (phase === "body" && !(error instanceof ApiError)) throw unavailable("body", error);
    throw new GeminiError(502, "The AI response was incomplete or invalid. No saved work has changed. Try again or continue manually.", diagnostic("INVALID_OUTPUT", phase));
  }
}
