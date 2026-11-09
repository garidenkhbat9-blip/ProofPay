import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStructured, GeminiError } from "../src/lib/gemini";
import { ApiError } from "../src/lib/api-http";
import { agreementDraftSchema, parseAgreementDraft } from "../src/lib/agreement-draft";
const data = {scope: "Build requested pages", title: "Website", deliverables: "Source files", criteria: ["Home page delivered"], review_notes: []};
const options = () => ({key: "fake-secret", system: "system", brief: "brief", schema: agreementDraftSchema,
  signal: new AbortController().signal, parse: (v: unknown) => parseAgreementDraft(v, {budget_amount: 42, due_date: "2026-11-10"})});
const reply = (body: unknown, status = 200) => (async () => Response.json(body, {status})) as typeof fetch;
const envelope = (value: unknown = data) => ({candidates: [{finishReason: "STOP", content: {parts: [{thought: true, text: "ignore"}, {text: JSON.stringify(value)}]}}]});
const status = (n: number) => (e: unknown) => e instanceof ApiError && e.status === n && !e.message.includes("fake-secret");
test("Gemini user messages distinguish permission, payload, quota and actual provider unavailability", async()=>{
 for(const [http, message] of [[400,/rejected/],[401,/denied access/],[403,/denied access/],[404,/model or endpoint/],[429,/quota limit/],[503,/returned a temporary/]] as const) {
  await assert.rejects(generateStructured(options(),reply({error:{message:"private details"}},http)),e=>e instanceof GeminiError && e.diagnostic.httpStatus===http && message.test(e.message) && !e.message.includes("private"));
 }
});
test("Gemini separates explicit transport timeout and DNS failure without exposing error detail",async()=>{
 for(const [error,kind] of [[new DOMException("secret","TimeoutError"),"TIMEOUT"],[new TypeError("secret",{cause:{code:"ENOTFOUND",hostname:"private"}}),"NETWORK"]] as const){
  await assert.rejects(generateStructured(options(),async()=>{throw error;}),e=>{
   assert(e instanceof GeminiError);assert.equal(e.diagnostic.kind,kind);assert.equal(e.diagnostic.httpStatus,undefined);assert.doesNotMatch(JSON.stringify(e),/secret|private/);return true;
  });
 }
});
test("Gemini content safeguards are distinct from malformed output and never return findings",async()=>{
 for(const body of [{promptFeedback:{blockReason:"SAFETY"}},{candidates:[{finishReason:"SAFETY"}]}]) await assert.rejects(generateStructured(options(),reply(body)),e=>e instanceof GeminiError && e.diagnostic.kind==="SAFETY" && e.status===422);
});
test("explicit invalid-key reasons are distinguished without exposing provider metadata",async()=>{
 await assert.rejects(generateStructured(options(),reply({error:{status:"INVALID_ARGUMENT",details:[{reason:"API_KEY_INVALID",metadata:{key:"private-secret"}}]}},400)),e=>{
  assert(e instanceof GeminiError);assert.equal(e.diagnostic.providerReason,"API_KEY_INVALID");assert.match(e.message,/server API key/);assert.doesNotMatch(JSON.stringify(e),/private-secret/);return true;
 });
});
test("Gemini transport sends structured REST and parses only final output", async () => {
  const transport = (async (url, init) => {
    assert.match(String(url), /gemini-3.8-flash:generateContent$/);
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "fake-secret");
    assert.deepEqual(JSON.parse(String(init?.body)).generationConfig.responseFormat.text.schema, agreementDraftSchema);
    return Response.json(envelope({...data, amount: 999}));
  }) as typeof fetch;
  const result = await generateStructured(options(), transport);
  assert.equal(result.result.milestone.amount, 42);
  assert.equal(result.result.milestone.due_date, "2026-11-10");
});
test("Gemini missing configuration, rate limits and provider errors fail safely", async () => {
  await assert.rejects(generateStructured({...options(), key: undefined}, async () => {throw Error("must not call");}), status(503));
  await assert.rejects(generateStructured({...options(), model: "../bad"}, reply({})), status(503));
  for (const code of [400,401,403,404,429,500]) await assert.rejects(generateStructured(options(), reply({error: "fake-secret"}, code)), status(code === 429 ? 429 : 503));
});
test("Gemini refuses truncated, blocked, malformed, oversized and invalid responses", async () => {
  for (const body of [{}, {candidates: [{finishReason: "MAX_TOKENS"}]}, envelope({...data, criteria: []}), envelope("x".repeat(130000))])
    await assert.rejects(generateStructured(options(), reply(body)), status(502));
});
test("Gemini connection and body-read cancellation cannot report success", async () => {
  await assert.rejects(generateStructured(options(), async () => {throw new DOMException("fake-secret", "TimeoutError");}), status(503));
  const controller = new AbortController();
  const transport = (async () => {
    controller.abort();
    return new Response(new ReadableStream({start(c) {c.error(new Error("fake-secret"));}}));
  }) as typeof fetch;
  await assert.rejects(generateStructured({...options(), signal: controller.signal}, transport), status(503));
});
test("Gemini diagnostics retain only safe HTTP/quota enums and never retry", async () => {
  let calls=0;
  const transport=(async()=>{calls++;return Response.json({error:{status:"RESOURCE_EXHAUSTED",message:"fake-secret",details:[{project:"private-project"}]}},{status:429,headers:{"Retry-After":"120"}});}) as typeof fetch;
  await assert.rejects(generateStructured(options(),transport),(error:unknown)=>{
    assert(error instanceof GeminiError);
    assert.equal(error.diagnostic.kind,"PROVIDER");assert.equal(error.diagnostic.httpStatus,429);
    assert.equal(error.diagnostic.providerStatus,"RESOURCE_EXHAUSTED");assert.equal(error.diagnostic.retryAfterSeconds,120);
    assert.doesNotMatch(JSON.stringify(error),/fake-secret|private-project/);return true;
  });assert.equal(calls,1);
});
test("Gemini distinguishes caller cancellation from a provider response and enforces request limits", async () => {
  const controller=new AbortController(); controller.abort(); let calls=0;
  const transport=(async()=>{calls++;return Response.json({});}) as typeof fetch;
  await assert.rejects(generateStructured({...options(),signal:controller.signal},transport),(error:unknown)=>error instanceof GeminiError && error.diagnostic.kind==="CANCELLED" && error.diagnostic.phase==="headers");
  await assert.rejects(generateStructured({...options(),brief:"x".repeat(512001)},transport),status(413));
  await assert.rejects(generateStructured({...options(),maxOutputTokens:100000},transport),status(503));
  assert.equal(calls,0);
});
test("Gemini distinguishes interrupted response transport from malformed model JSON", async () => {
  const transport=(async()=>new Response(new ReadableStream({start(c){c.error(new TypeError('private transport failure'));}}))) as typeof fetch;
  await assert.rejects(generateStructured(options(),transport),(error:unknown)=>error instanceof GeminiError && error.status===503 && error.diagnostic.kind==='NETWORK' && error.diagnostic.phase==='body');
});
