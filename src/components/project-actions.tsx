"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { memberRole } from "@/lib/domain";
import {
  archiveReasons,
  archiveRequest,
  type ArchiveState,
} from "@/lib/project-archive";
import { getSupabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { useWorkspace } from "./provider";
import { FormMessage, Modal } from "./ui";

export function ProjectActions({ project }: { project: Project }) {
  const { data, user, perspective } = useWorkspace();
  const [open, setOpen] = useState(false),
    [review, setReview] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const wasReviewOpen = useRef(false);
  const panelId = useId();
  useEffect(() => {
    if (wasReviewOpen.current && !review) trigger.current?.focus();
    wasReviewOpen.current = review;
  }, [review]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (
    perspective !== "client" ||
    project.created_by !== user?.id ||
    memberRole(data, project.id, user?.id) !== "client"
  )
    return null;
  return (
    <div
      ref={root}
      className="project-actions"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="project-action-trigger"
        aria-label={`Actions for ${project.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <div className="project-action-menu" id={panelId}>
          <Link href={`/projects/${project.id}`} onClick={() => setOpen(false)}>
            View project
          </Link>
          <button
            onClick={() => {
              setReview(true);
              setOpen(false);
            }}
          >
            {project.status === "archived"
              ? "Reopen project"
              : "Archive project"}
          </button>
        </div>
      )}
      {review && (
        <ArchiveDialog project={project} onClose={() => setReview(false)} />
      )}
    </div>
  );
}

function ArchiveDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { user, refreshChecked: refresh, notice } = useWorkspace();
  const [action] = useState<"archive" | "reopen">(
    project.status === "archived" ? "reopen" : "archive",
  );
  const label = action === "archive" ? "Archive" : "Reopen";
  const [state, setState] = useState<ArchiveState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null),
    lock = useRef(false),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setState(null);
    setError("");
    archiveRequest(getSupabase(), user!.id, project.id)
      .then((result) => {
        if (alive) setState(result);
      })
      .catch(() => {
        if (alive)
          setError(
            "Archive eligibility could not be checked. Try again before making changes.",
          );
      });
    return () => {
      alive = false;
    };
  }, [user?.id, project.id, reload]);
  async function submit() {
    if (lock.current || !state || confirmed) return;
    lock.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      await archiveRequest(getSupabase(), user!.id, project.id, {
        action,
        requestId: requestId.current,
        expectedRevision: state.revision,
      });
      if (!mounted.current) return;
      setConfirmed(true);
      try {
        await refresh();
        notice(
          `${label} request confirmed. Your workspace now shows the current project state.`,
        );
        onClose();
      } catch {
        if (mounted.current)
          setError(
            "Your action was recorded, but the workspace could not refresh. Refresh the workspace to see the current state.",
          );
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error && e.name !== "TimeoutError"
            ? e.message
            : "The action could not be confirmed. Retry to check the same request.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const allowed =
    state?.available &&
    (action === "archive" ? state.canArchive : state.canReopen);
  return (
    <Modal title={`${label} project`} onClose={onClose} busy={busy}>
      <p className="dialogintro">
        <strong>{project.title}</strong>
      </p>
      <p>
        {action === "archive"
          ? "Archive this unshared draft? It leaves active project counts and planned-budget totals. New invitations and agreement changes stop until you reopen it. All existing records are retained."
          : "Reopen this archived draft? It returns to active project listings and planned-budget totals. Existing records are retained."}
      </p>
      {!state && !error && (
        <p role="status">Checking owner permissions and project history…</p>
      )}
      {state?.reason && (
        <div className="notice" role="status">
          {archiveReasons[state.reason]}
        </div>
      )}
      {state && !state.reason && !allowed && (
        <p role="status">
          The project state has changed. Close this dialog and refresh your
          workspace.
        </p>
      )}
      {state?.reason === "INVITATION_PENDING" && (
        <Link href={`/projects/${project.id}#project-team`} onClick={onClose}>
          Manage invitation →
        </Link>
      )}
      <FormMessage error={error} />
      {confirmed && (
        <p role="status">
          Request recorded. No additional archive request will be sent.
        </p>
      )}
      <div className="dialogfooter">
        <button disabled={busy} onClick={onClose}>
          Close
        </button>
        {error && !confirmed && (
          <button
            disabled={busy}
            onClick={() => {
              requestId.current = null;
              setReload(reload + 1);
            }}
          >
            Reload eligibility
          </button>
        )}
        {confirmed ? (
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void refresh()
                .then(onClose)
                .catch(() =>
                  setError(
                    "Workspace refresh failed. Your recorded action is retained.",
                  ),
                )
                .finally(() => {
                  if (mounted.current) setBusy(false);
                });
            }}
          >
            Refresh workspace
          </button>
        ) : (
          <button
            className="primary"
            disabled={!allowed || busy}
            onClick={() => void submit()}
          >
            {busy
              ? "Saving…"
              : allowed
                ? `${label} project`
                : `${label} unavailable`}
          </button>
        )}
      </div>
    </Modal>
  );
}
