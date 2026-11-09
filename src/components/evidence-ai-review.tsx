"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Artifact, Criterion, Submission } from "@/lib/types";
import {
  reportMatches,
  findingLabels,
  type EvidenceReport,
} from "@/lib/evidence-review";
import { useWorkspace } from "./provider";
import "@/app/evidence-review.css";

export function EvidenceAiReview({
  submission,
  criteria,
  artifacts,
  agreementId,
  agreementVersion,
  canAnalyze,
  evidence,
  decision,
}: {
  submission: Submission;
  criteria: Criterion[];
  artifacts: Artifact[];
  agreementId: string;
  agreementVersion: number;
  canAnalyze: boolean;
  evidence: ReactNode;
  decision: ReactNode;
}) {
  const { user } = useWorkspace();
  const [saved, setSaved] = useState<{
    owner: string;
    report: EvidenceReport;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    locked = useRef(false);
  const identity = user?.id;
  const binding = `${identity}:${submission.project_id}:${submission.milestone_id}:${agreementId}:${submission.id}:${submission.revision}:${canAnalyze}`;
  const current = useRef(binding);
  current.current = binding;
  useEffect(() => {
    current.current = binding;
    setError("");
    setBusy(false);
    locked.current = false;
    return () => {
      current.current = "";
      controller.current?.abort();
    };
  }, [binding]);
  useEffect(() => {
    setSaved(null);
  }, [identity]);
  const report =
    saved &&
    saved.owner === identity &&
    reportMatches(saved.report, submission, agreementId)
      ? saved.report
      : null;
  async function analyze() {
    if (locked.current || !canAnalyze || !identity) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const started = binding;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { data, error: authError } = await getSupabase().auth.getSession();
      if (authError || !data.session || data.session.user.id !== identity)
        throw Error("Sign in again to analyze evidence.");
      if (current.current !== started) return;
      let response: Response;
      try { response = await fetch(
        `/api/projects/${submission.project_id}/submissions/${submission.id}/ai-review`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(115000)]),
        },
      ); } catch { throw Error("The analysis request could not reach the server or timed out. Your submission is unchanged; continue reviewing manually."); }
      let body;
      try { body = await response.json(); } catch { throw Error("The server did not return a usable analysis. No findings were generated. Try again later or review manually."); }
      if (!response.ok)
        throw Error(
          typeof body?.error === "string"
            ? body.error
            : "Analysis unavailable. Review the evidence manually.",
        );
      if (
        !reportMatches(body, submission, agreementId) ||
        body.agreementVersion !== agreementVersion
      )
        throw Error("Review context changed. Refresh before analyzing again.");
      if (current.current === started)
        setSaved({ owner: identity, report: body });
    } catch (e) {
      if (current.current === started && !abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Analysis unavailable. Try again.",
        );
    } finally {
      if (current.current === started) {
        setBusy(false);
        locked.current = false;
      }
    }
  }
  const inspected =
    report?.observations.filter((o) => o.status !== "NOT_CHECKED").length || 0;
  return (
    <section className="ai-review" aria-label="AI Review Center">
      <header className="ai-review-heading">
        <div>
          <span className="ai-kicker">ProofPay / Evidence intelligence</span>
          <h2>AI Review Center</h2>
          <p>
            Agreement v{agreementVersion} / Revision {submission.revision} /
            Advisory only
          </p>
          <p className="ai-submitted">
            Submitted{" "}
            {new Date(
              submission.submitted_at || submission.created_at,
            ).toLocaleString()}{" "}
            · {artifacts.length} evidence items
          </p>
        </div>
        <span className="ai-edition">Human decision required</span>
      </header>
      <div className="ai-summary" aria-live="polite" aria-busy={busy}>
        <div>
          <span className="ai-kicker">AI Review Summary</span>
          <h3>
            {busy
              ? "Reading the submitted text…"
              : error
                ? "Analysis unavailable"
                : report
                  ? canAnalyze
                    ? `${inspected} of ${criteria.length} requirements assessed`
                    : "Historical analysis"
                  : canAnalyze
                    ? "A clearer view of the evidence"
                    : "Review record"}
          </h3>
          <p>
            {busy ? "Checking the available text against each requirement. No approval or payment action will be taken." : report
              ? report.summary
              : "Compare the agreed requirements with the submitted text. Inspect visual work and linked content personally."}
          </p>
          {report && !canAnalyze && (
            <p>
              This analysis is historical, not a current recommendation. It
              belongs only to revision {report.revision}, agreement v
              {report.agreementVersion}.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        {canAnalyze &&
          (report && !error ? (
            <a className="buttonlike" href={`#ai-findings-${submission.id}`}>
              Review findings ↓
            </a>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void analyze()}
            >
              {busy
                ? "Analyzing…"
                : error
                  ? "Retry analysis"
                  : "Analyze evidence"}
            </button>
          ))}
      </div>
      {canAnalyze && !report && (
        <p className="ai-consent">
          Sends this agreement’s criteria, notes and up to four text files to
          Gemini. Images, PDFs, HTML and external links are not inspected.
        </p>
      )}
      <div className="ai-desk">
        <section
          className="ai-requirements"
          aria-label="Agreement requirements"
        >
          <h3>
            <span>01</span> Agreement requirements
          </h3>
          <ol>
            {criteria.map((c) => {
              const o = report?.observations.find(
                (o) => o.criterionId === c.id,
              );
              return (
                <li key={c.id}>
                  <a href={`#finding-${submission.id}-${c.id}`}>
                    {c.description}
                  </a>
                  <small className={`ai-status ${o?.status || "NOT_CHECKED"}`}>
                    {o ? findingLabels[o.status] : "Not checked"}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="ai-evidence" aria-label="Submitted evidence">
          <h3>
            <span>02</span> Submitted evidence
          </h3>
          {evidence}
          <div className="ai-inspection-ledger">
            {submission.notes && (
              <p>
                <strong>Submission notes</strong>
                <small>
                  {report?.sources.some((s) => s.id === "submission-notes")
                    ? "Text inspected · author claims, not proof"
                    : "Author claims · not yet inspected"}
                </small>
              </p>
            )}
            {artifacts.map((a) => (
              <p key={a.id}>
                <strong>{a.label}</strong>
                <small>
                  {report?.sources.some((s) => s.id === a.id)
                    ? "Text inspected · claims not independently verified"
                    : a.kind === "url"
                      ? "Link provided · contents not checked"
                      : /\.(txt|md|csv|json)$/i.test(a.label)
                        ? report?.unread.find((u) => u.id === a.id)?.reason ||
                          "Text file · not yet inspected"
                        : "File received · contents not checked"}
                </small>
              </p>
            ))}
            {!artifacts.length && <p>No uploaded files or links.</p>}
          </div>
        </section>
        <section
          className="ai-findings"
          id={`ai-findings-${submission.id}`}
          tabIndex={-1}
          aria-label="AI findings and human decision"
        >
          <h3>
            <span>03</span> Findings & decision
          </h3>
          {!report && (
            <p className="ai-muted">
              {busy
                ? "Comparing supported text with each requirement."
                : "No AI findings yet. You can review and decide without AI."}
            </p>
          )}
          {criteria.map((c) => {
            const o = report?.observations.find((o) => o.criterionId === c.id);
            return (
              <article
                className="ai-finding"
                id={`finding-${submission.id}-${c.id}`}
                key={c.id}
              >
                <span className={`ai-status ${o?.status || "NOT_CHECKED"}`}>
                  {o ? findingLabels[o.status] : "Not checked"}
                </span>
                <h4>{c.description}</h4>
                {o && (
                  <>
                    <p>{o.observation}</p>
                    {o.missingEvidence && (
                      <p className="ai-concern">{o.missingEvidence}</p>
                    )}
                    <p className="ai-references">
                      Related:{" "}
                      {o.evidenceIds
                        .map(
                          (id) =>
                            report?.sources.find((s) => s.id === id)?.label ||
                            report?.unread.find((s) => s.id === id)?.label,
                        )
                        .join(" · ") || "No associated evidence"}
                    </p>
                    <details>
                      <summary>Evidence & explanation</summary>
                      <p>
                        Text inspected for this finding:{" "}
                        {o.citations
                          .map(
                            (c) =>
                              report?.sources.find((s) => s.id === c.sourceId)
                                ?.label,
                          )
                          .join(" · ") || "None"}
                      </p>
                      {o.citations.map((ref, i) => (
                        <blockquote key={i}>
                          “{ref.quote}”
                          <cite>
                            {
                              report?.sources.find((s) => s.id === ref.sourceId)
                                ?.label
                            }
                          </cite>
                        </blockquote>
                      ))}
                      {o.limitations.map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                      {o.questions.map((q, i) => (
                        <p key={i}>{q}</p>
                      ))}
                      <p>
                        Quotes establish what the source says, not whether its
                        claims are true. No visual, website or functional checks
                        ran.
                      </p>
                    </details>
                  </>
                )}
              </article>
            );
          })}
          <div className="ai-human-decision">
            {decision || (
              <p>Human decision is recorded in the revision history.</p>
            )}
          </div>
        </section>
      </div>
      <details className="ai-audit">
        <summary>Analysis limits & record</summary>
        <p>
          AI findings are advisory. Only UTF-8 TXT, MD, CSV and JSON (32 KB per
          file, 64,000 characters total) and submission notes can be read. URLs,
          Figma, images, PDFs, HTML and archives are not inspected. No approval
          or payment is created.
        </p>
        <p>
          Analysis is private to this client and temporary in this open view.
          Leaving or refreshing clears it; human decisions and submitted
          evidence remain saved.
        </p>
        {report && (
          <>
            <p>
              {report.model} · {report.promptVersion} ·{" "}
              {new Date(report.generatedAt).toLocaleString()}
            </p>
            <ul>
              {report.sources.map((s) => (
                <li key={s.id}>
                  {s.label} · {s.characters} characters <code>{s.sha256}</code>
                </li>
              ))}
            </ul>
            <ul>
              {report.unread.map((s) => (
                <li key={s.id}>
                  {s.label}: {s.reason}
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
