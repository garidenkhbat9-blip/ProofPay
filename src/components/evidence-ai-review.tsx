"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Criterion, Submission } from "@/lib/types";
import type { EvidenceReport } from "@/lib/evidence-review";
import { useWorkspace } from "./provider";
import { FormMessage, useTask } from "./ui";

export function EvidenceAiReview({submission, criteria}: {submission: Submission; criteria: Criterion[]}) {
  const {user} = useWorkspace(), task = useTask();
  const [report, setReport] = useState<EvidenceReport | null>(null);
  const identity = user?.id;
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => { current.current = identity; setReport(null); return () => {current.current = undefined;}; }, [identity, submission.id]);
  return <section className="verification-unavailable" aria-label="AI evidence assistant">
    <strong>AI evidence assistant · Human decision required</strong>
    <p>Analyze sends accepted criteria, submission notes and up to four UTF-8 TXT, MD, CSV or JSON files (32 KB each, 64,000 characters total) to Gemini. Websites, images, PDFs and archives are not inspected. AI observations are unverified opinions and do not approve work or authorize payment.</p>
    <button disabled={task.busy} onClick={() => void task.run(async () => {
      setReport(null);
      const {data, error} = await getSupabase().auth.getSession();
      if (error || !data.session || data.session.user.id !== identity) throw Error("Sign in again to analyze evidence.");
      const response = await fetch(`/api/projects/${submission.project_id}/submissions/${submission.id}/ai-review`, {
        method: "POST", headers: {Authorization: `Bearer ${data.session.access_token}`}, signal: AbortSignal.timeout(115000),
      });
      const body = await response.json();
      if (!response.ok) throw Error(typeof body.error === "string" ? body.error : "AI analysis unavailable. Review manually.");
      if (current.current === identity && body.submissionId === submission.id && body.revision === submission.revision) setReport(body);
    })}>{task.busy ? "Reading evidence…" : "Analyze text with Gemini"}</button>
    <FormMessage error={task.error} />
    {report && <div aria-live="polite">
      <p className="subtle">AI opinion · Agreement v{report.agreementVersion} · Revision {report.revision} · {report.model} · {new Date(report.generatedAt).toLocaleString()}</p>
      <p>This temporary analysis is not saved. Quotes establish what the source says, not whether its claims are true. Final review remains with you.</p>
      {report.observations.map(o => <div className="sectionspace" key={o.criterionId}>
        <h4>{criteria.find(c=>c.id===o.criterionId)?.description}</h4>
        <p><strong>{o.status}</strong> · {o.observation}</p>
        {o.citations.map((c,i)=><blockquote key={i}>“{c.quote}” — {report.sources.find(s=>s.id===c.sourceId)?.label}</blockquote>)}
        {o.missingEvidence && <p>Missing evidence / potential inconsistency: {o.missingEvidence}</p>}
        {o.questions.length > 0 && <ul>{o.questions.map((q,i)=><li key={i}>{q}</li>)}</ul>}
      </div>)}
      <details><summary>Sources read and analysis limits</summary>
        <ul>{report.sources.map(s=><li key={s.id}>{s.label} · {s.characters} characters · SHA-256 <span style={{overflowWrap: "anywhere"}}>{s.sha256}</span></li>)}</ul>
        <ul>{report.unread.map(s=><li key={s.id}>{s.label}: {s.reason}</li>)}</ul>
        <p>No website checks executed. No approval or payment created.</p>
      </details>
    </div>}
  </section>;
}
