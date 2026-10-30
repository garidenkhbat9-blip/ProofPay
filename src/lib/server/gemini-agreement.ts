import "server-only";
import {
  agreementDraftPrompt,
  agreementDraftSchema,
  parseAgreementDraft,
} from "../agreement-draft";
import type { Project } from "../types";
import { ApiError, readJsonBounded } from "./http";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export async function generateAgreementDraft(
  project: Project,
  scope: string,
  signal: AbortSignal,
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key)
    throw new ApiError(
      503,
      "AI drafting is not configured. You can still write and save the agreement manually.",
    );
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model))
    throw new ApiError(
      503,
      "The AI drafting model is not configured correctly.",
    );
  const prompt = agreementDraftPrompt(project, scope);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.brief }] }],
          generationConfig: {
            maxOutputTokens: 6000,
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: agreementDraftSchema,
              },
            },
          },
        }),
      },
    );
  } catch {
    throw new ApiError(
      503,
      "AI drafting timed out or could not connect. Your agreement has not changed. Try again.",
    );
  }
  if (response.status === 429)
    throw new ApiError(
      429,
      "AI drafting is busy. Wait a moment, then try again.",
    );
  if (!response.ok)
    throw new ApiError(
      503,
      "The AI provider could not create a draft. Check the server's Gemini key and model configuration, or continue manually.",
    );
  try {
    const body = (await readJsonBounded(response, 128000)) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
    };
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== "STOP")
      throw new Error("Incomplete generation");
    const text = candidate.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
    if (!text || text.length > 50000) throw new Error("Invalid draft size");
    return { draft: parseAgreementDraft(JSON.parse(text), project), model };
  } catch {
    throw new ApiError(
      502,
      "The AI draft was incomplete or invalid. Your agreement has not changed. Please try again or continue manually.",
    );
  }
}
