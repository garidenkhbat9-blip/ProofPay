"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { AgreementDraft } from "@/lib/agreement-draft";
import type { Project } from "@/lib/types";
import { FormMessage, useTask } from "./ui";

export function AgreementDraftBuilder({
  project,
  scope,
  disabled,
  onApply,
}: {
  project: Project;
  scope: string;
  disabled: boolean;
  onApply: (draft: AgreementDraft) => void;
}) {
  const task = useTask();
  const [result, setResult] = useState<{
    draft: AgreementDraft;
    model: string;
    sourceScope: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  if (project.work_category !== "website") return null;
  const changed = !!result && result.sourceScope !== scope;
  async function generate() {
    await task.run(async () => {
      if (!scope.trim())
        throw new Error("Add a scope of work before requesting a draft.");
      setMessage("");
      const { data, error } = await getSupabase().auth.getSession();
      if (error || !data.session)
        throw new Error("Sign in again before requesting an AI draft.");
      let response: Response;
      try {
        response = await fetch(`/api/projects/${project.id}/agreement-draft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ scope }),
          signal: AbortSignal.timeout(60000),
        });
      } catch {
        throw new Error(
          "AI drafting could not connect or timed out. Your agreement has not changed. Try again.",
        );
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error(
          "AI drafting returned an invalid response. Your agreement has not changed.",
        );
      }
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "AI drafting is unavailable. Your agreement has not changed.",
        );
      if (!body.draft || !body.model)
        throw new Error(
          "The AI draft was incomplete. Your agreement has not changed.",
        );
      setResult({ draft: body.draft, model: body.model, sourceScope: scope });
      setMessage(
        "Draft ready for review. No agreement has been saved or accepted.",
      );
    });
  }
  return (
    <section className="agreement-ai" aria-label="AI agreement draft">
      <div className="sectionhead">
        <div>
          <h3>Draft measurable requirements</h3>
          <p>
            Generate one website milestone from your brief, then review every
            requirement.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || task.busy || !scope.trim()}
          onClick={() => void generate()}
        >
          {task.busy
            ? "Drafting with Gemini…"
            : result
              ? "Generate another draft"
              : "Draft with Gemini"}
        </button>
      </div>
      <p className="fieldhelp">
        This sends your project brief and current scope to Google Gemini. Your
        amount and due date stay unchanged. AI output is a draft, not
        verification or approval.
      </p>
      <FormMessage error={task.error} />
      <p className="agreement-ai-status" role="status">
        {message}
      </p>
      {result && (
        <div className="agreement-ai-preview">
          <div className="sectionhead">
            <strong>Suggested draft</strong>
            <span className="subtle">{result.model}</span>
          </div>
          <p className="preservelines">{result.draft.scope}</p>
          <h4>{result.draft.milestone.title}</h4>
          <p>{result.draft.milestone.description}</p>
          <ol>
            {result.draft.milestone.criteria.map((criterion, index) => (
              <li key={index}>{criterion}</li>
            ))}
          </ol>
          {!!result.draft.reviewNotes.length && (
            <div className="agreement-ai-questions">
              <strong>Resolve before accepting</strong>
              <ul>
                {result.draft.reviewNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {changed && (
            <p className="fieldhelp">
              Your scope changed after this draft was generated. Generate a
              fresh draft to use the updated scope.
            </p>
          )}
          <p className="fieldhelp">
            Using this draft replaces the scope and milestone fields in this
            editor. You can edit them before saving a new agreement version.
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setMessage("");
              }}
              disabled={disabled || task.busy}
            >
              Discard draft
            </button>
            <button
              type="button"
              className="primary"
              disabled={disabled || task.busy || changed}
              onClick={() => {
                onApply(result.draft);
                setResult(null);
                setMessage(
                  "Draft applied to the editor. Review the criteria and choose a due date before saving.",
                );
              }}
            >
              Use this draft
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
