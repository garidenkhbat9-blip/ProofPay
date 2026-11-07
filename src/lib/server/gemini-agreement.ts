import "server-only";
import { agreementDraftPrompt, agreementDraftSchema, parseAgreementDraft } from "../agreement-draft";
import { generateStructured } from "../gemini";
import type { Project } from "../types";
export { DEFAULT_GEMINI_MODEL } from "../gemini";

export async function generateAgreementDraft(project: Project, scope: string, signal: AbortSignal) {
  const prompt = agreementDraftPrompt(project, scope);
  const { result: draft, model } = await generateStructured({
    key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL,
    ...prompt, schema: agreementDraftSchema, parse: value => parseAgreementDraft(value, project), signal,
  });
  return { draft, model };
}
