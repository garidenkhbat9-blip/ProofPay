import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artifact, Submission, Criterion } from "../types";
import { ApiError } from "../api-http";
import { collectEvidenceText, evidenceReviewPrompt, evidenceReviewSchema, parseEvidenceReview, MAX_TEXT_BYTES, type EvidenceReport } from "../evidence-review";
import { generateStructured } from "../gemini";

export async function reviewSubmissionText(client: SupabaseClient, projectId: string, submissionId: string, signal: AbortSignal): Promise<EvidenceReport> {
  const submission = await client.from("evidence_submissions").select("*").eq("id", submissionId).eq("project_id", projectId).maybeSingle();
  if (submission.error) throw new ApiError(503, "Evidence could not be loaded. Try again.");
  if (!submission.data || submission.data.status === "uploading") throw new ApiError(404, "Submitted evidence not found.");
  const s = submission.data as Submission;
  const milestone = await client.from("milestones").select("agreement_id").eq("id", s.milestone_id).maybeSingle();
  if (milestone.error || !milestone.data) throw new ApiError(503, "Accepted terms could not be loaded.");
  const [agreement, approvals, criteria, artifacts] = await Promise.all([
    client.from("agreements").select("id,version,scope").eq("id", milestone.data.agreement_id).eq("project_id", projectId).maybeSingle(),
    client.from("agreement_approvals").select("role").eq("agreement_id", milestone.data.agreement_id),
    client.from("acceptance_criteria").select("*").eq("milestone_id", s.milestone_id).order("position").limit(31),
    client.from("evidence_artifacts").select("*").eq("submission_id", s.id).order("id").limit(11),
  ]);
  if (agreement.error || approvals.error || criteria.error || artifacts.error) throw new ApiError(503, "Evidence context could not be loaded.");
  if (!agreement.data || !["client", "freelancer"].every(role=>approvals.data?.some(a=>a.role===role))) throw new ApiError(409, "Both parties must accept these terms before AI review.");
  if (!criteria.data?.length || criteria.data.length > 30 || !artifacts.data || artifacts.data.length > 10) throw new ApiError(422, "Evidence context exceeds supported limits.");
  const {sources, unread} = await collectEvidenceText(s, artifacts.data as Artifact[], async a => {
    const signed = await client.storage.from("proofpay-evidence").createSignedUrl(a.storage_path!, 60);
    if (signed.error || !signed.data) throw Error("File unavailable");
    const url = new URL(signed.data.signedUrl);
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || url.username || url.password ||
      decodeURIComponent(url.pathname) !== "/storage/v1/object/sign/proofpay-evidence/" + a.storage_path)
      throw Error("Signed URL does not match the requested artifact");
    const response = await fetch(url, {cache: "no-store", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)])});
    if (!response.ok || Number(response.headers.get("content-length")) > MAX_TEXT_BYTES) { await response.body?.cancel(); throw Error("File unavailable"); }
    const reader = response.body?.getReader();
    if (!reader) throw Error("No file body");
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > MAX_TEXT_BYTES) {await reader.cancel(); throw Error("File too large");}
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  }, signal);
  if (!sources.length) throw new ApiError(422, "CANNOT_VERIFY: no readable notes or supported text files. Review the evidence manually.");
  const prompt = evidenceReviewPrompt(agreement.data.scope, criteria.data as Criterion[], sources);
  const {result: observations, model} = await generateStructured({key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL,
    ...prompt, schema: evidenceReviewSchema, parse: v => parseEvidenceReview(v, criteria.data as Criterion[], sources), signal});
  return {submissionId: s.id, revision: s.revision, agreementId: agreement.data.id, agreementVersion: agreement.data.version,
    model, generatedAt: new Date().toISOString(), promptVersion: "evidence-text-v1", observations, unread,
    sources: sources.map(source=>({id: source.id, label: source.label, characters: source.text.length, sha256: createHash("sha256").update(source.text).digest("hex")}))};
}
