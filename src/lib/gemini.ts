import { ApiError, readJsonBounded } from "./api-http";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export interface GeminiDiagnostic {
  kind: "TIMEOUT" | "CANCELLED" | "NETWORK" | "PROVIDER" | "INVALID_OUTPUT";
  phase: "headers" | "body" | "parse";
  model: string; requestBytes: number; elapsedMs: number;
  httpStatus?: number; providerStatus?: string; retryAfterSeconds?: number;
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
  const unavailable = (phase: GeminiDiagnostic["phase"]) => new GeminiError(503,
    "AI timed out or could not connect. No saved work has changed. Try again.",
    diagnostic(options.signal.aborted ? "CANCELLED" : signal.aborted ? "TIMEOUT" : "NETWORK", phase));
  let response: Response;
  try {
    signal.throwIfAborted();
    response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": options.key },
      cache: "no-store", redirect: "error", signal,
      body,
    });
  } catch { throw unavailable("headers"); }
  if (!response.ok) {
    // Whitelist provider enums only. Never expose raw message/details, prompts,
    // response text, URLs, credentials or quota project identifiers.
    let providerStatus: string | undefined;
    try {
      const error = await readJsonBounded(response, 16000) as {error?: {status?: string}};
      if (["RESOURCE_EXHAUSTED", "INVALID_ARGUMENT", "PERMISSION_DENIED", "NOT_FOUND", "UNAVAILABLE", "INTERNAL", "UNAUTHENTICATED", "DEADLINE_EXCEEDED"].includes(error?.error?.status || "")) providerStatus = error.error!.status;
    } catch { /* The HTTP status remains authoritative even if diagnostics fail. */ }
    const retry = Number(response.headers.get("retry-after"));
    throw new GeminiError(response.status === 429 ? 429 : 503,
      response.status === 429 ? "AI is busy. Wait a moment, then try again." : "The AI provider could not complete the request. Check the Gemini key and model configuration, or continue manually.",
      {...diagnostic("PROVIDER", "headers"), httpStatus: response.status, providerStatus,
        ...(Number.isInteger(retry) && retry > 0 && retry <= 3600 ? {retryAfterSeconds: retry} : {})});
  }
  let phase: GeminiDiagnostic["phase"] = "body";
  try {
    const body = await readJsonBounded(response, 128000) as {
      candidates?: { finishReason?: string; content?: {parts?: {text?: string; thought?: boolean}[]} }[];
    };
    phase = "parse";
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw Error("Incomplete generation");
    const text = candidate.content?.parts?.filter(p => !p.thought).map(p => p.text || "").join("");
    if (!text || text.length > 50000) throw Error("Invalid result size");
    return { result: options.parse(JSON.parse(text)), model };
  } catch (error) {
    if (signal.aborted) throw unavailable(phase);
    if (phase === "body" && !(error instanceof ApiError)) throw unavailable("body");
    throw new GeminiError(502, "The AI response was incomplete or invalid. No saved work has changed. Try again or continue manually.", diagnostic("INVALID_OUTPUT", phase));
  }
}
