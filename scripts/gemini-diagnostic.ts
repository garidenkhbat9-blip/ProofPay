import { generateStructured, DEFAULT_GEMINI_MODEL, GeminiError } from "../src/lib/gemini";
async function main() {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model) || !process.env.GEMINI_API_KEY) throw Error("Gemini configuration missing/invalid");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
    headers: {"x-goog-api-key": process.env.GEMINI_API_KEY}, redirect: "error", signal: AbortSignal.timeout(15000),
  });
  console.log(JSON.stringify({check: "model", model, httpStatus: response.status}));
  if (!response.ok) {process.exitCode=1; return;}
  const metadata = await response.json();
  console.log(JSON.stringify({supportsGeneration: metadata.supportedGenerationMethods?.includes("generateContent"),
    inputTokenLimit: metadata.inputTokenLimit, outputTokenLimit: metadata.outputTokenLimit}));
  if (!metadata.supportedGenerationMethods?.includes("generateContent")) {process.exitCode=1; return;}
  const started=Date.now();
  try {
    const result = await generateStructured({key: process.env.GEMINI_API_KEY, model,
      system: "Return only the JSON object required by the schema.", brief: "Set ok to true.",
      schema: {type: "object",properties: {ok: {type: "boolean"}},required: ["ok"]},
      maxOutputTokens: 1024, signal: new AbortController().signal,
      parse: (v: unknown) => {if (!(v && typeof v === "object" && "ok" in v && v.ok === true)) throw Error("Invalid shape"); return true;},
    });
    console.log(JSON.stringify({check:"minimalStructured",status:"PASS",valid:result.result,elapsedMs:Date.now()-started}));
  } catch(error) {
    console.log(JSON.stringify({check:"minimalStructured",status:"BLOCKED",diagnostic:error instanceof GeminiError ? error.diagnostic : {kind:"CONFIG_OR_NETWORK"}}));
    process.exitCode=1;
  }
}
void main().catch(()=>{console.log('BLOCKED: metadata request/configuration failed; no generation attempted');process.exitCode=1;});
