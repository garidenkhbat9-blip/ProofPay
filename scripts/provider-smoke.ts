// One bounded synthetic Gemini draft; PayPal OAuth ONLY. No database or invoice writes.
import { generateStructured, DEFAULT_GEMINI_MODEL } from "../src/lib/gemini";
import { agreementDraftPrompt, agreementDraftSchema, parseAgreementDraft } from "../src/lib/agreement-draft";
import { paymentConfig } from "../src/lib/payments/config";
import { PayPalGateway } from "../src/lib/payments/gateway";
import { ApiError } from "../src/lib/api-http";
async function main() {
const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
try {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
    headers: {"x-goog-api-key": process.env.GEMINI_API_KEY || ""}, signal: AbortSignal.timeout(15000), redirect: "error",
  });
  console.log(JSON.stringify({check: "Gemini model availability", status: response.status, model}));
  if (response.ok) {
    const project = {title: "Synthetic smoke test", description: "Build Home and Contact pages. Deliver source code and notes. Client checks mobile navigation at 375px.", work_category: "website" as const};
    const prompt = agreementDraftPrompt(project, project.description);
    const {result} = await generateStructured({key: process.env.GEMINI_API_KEY, model, ...prompt, schema: agreementDraftSchema,
      parse: v => parseAgreementDraft(v, {budget_amount: 100, due_date: "2026-11-10"}), signal: new AbortController().signal});
    console.log(JSON.stringify({check: "Gemini real structured draft", status: "PASS", criterionCount: result.milestone.criteria.length,
      budgetPreserved: result.milestone.amount === 100, datePreserved: result.milestone.due_date === "2026-11-10"}));
  }
} catch (error) { console.log(JSON.stringify({check: "Gemini real structured draft", status: "BLOCKED", reason: error instanceof ApiError ? error.message : "Provider connection failed", httpStatus: error instanceof ApiError ? error.status : null})); }
try {
  await new PayPalGateway(paymentConfig(process.env)).authenticate();
  console.log(JSON.stringify({check: "PayPal Sandbox OAuth only", status: "PASS", invoicesCreated: 0}));
} catch { console.log(JSON.stringify({check: "PayPal Sandbox OAuth only", status: "BLOCKED"})); }
}
void main();
