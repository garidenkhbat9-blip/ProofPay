"use client";
import Link from "next/link";
import { useWorkspace } from "./provider";
import {
  projectWorkspace,
  workspaceHref,
  type ProjectPhase,
} from "@/lib/project-workspace";
import "@/app/project-workspace.css";

export function ProjectPhaseNavigation({
  id,
  selected,
}: {
  id: string;
  selected: ProjectPhase;
}) {
  const { data, user } = useWorkspace();
  const model = projectWorkspace(data, id, user?.id);
  if (!model) return null;
  return (
    <nav className="project-phase-nav" aria-label="Project phases">
      {model.phases.map((phase, i) => (
        <Link
          key={phase.id}
          href={workspaceHref(id, phase.id)}
          aria-current={selected === phase.id ? "page" : undefined}
          className={`pp-phase pp-${phase.state}`}
          title={phase.detail}
        >
          <span className="pp-number" aria-hidden="true">
            {phase.state === "complete" ? "✓" : `0${i + 1}`}
          </span>
          <span>
            <strong>{phase.label}</strong>
            <small>{phase.state.replace("_", " ")}</small>
          </span>
        </Link>
      ))}
    </nav>
  );
}

// Legacy route entry points retain their full forms and records.
export function ProjectTabs({
  id,
  tab,
}: {
  id: string;
  tab: "overview" | "agreement" | "delivery";
}) {
  const phase = tab === "delivery" ? "deliver" : "setup";
  return (
    <div className="project-route-navigation">
      <Link className="backlink" href={workspaceHref(id, phase)}>
        ← Project workspace
      </Link>
      <ProjectPhaseNavigation id={id} selected={phase} />
    </div>
  );
}
