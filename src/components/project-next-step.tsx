"use client";
import Link from "next/link";
import { projectStages, type ProjectNextStep } from "@/lib/project-workflow";

export function ProjectNextAction({
  step,
  onInvite,
}: {
  step: ProjectNextStep;
  onInvite?: () => void;
}) {
  return (
    <section
      className="project-next-action"
      aria-label="Current stage and next action"
    >
      <ol className="project-progress" aria-label="Project progress">
        {projectStages.map((stage, index) => (
          <li
            key={stage}
            aria-current={index === step.stage ? "step" : undefined}
            className={index < step.stage ? "complete" : ""}
          >
            <span aria-hidden="true">
              {index < step.stage ? "✓" : index + 1}
            </span>
            {stage}
          </li>
        ))}
      </ol>
      <div className="project-next-body">
        <div>
          <p className="project-next-status">{step.status}</p>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
        </div>
        {step.action === "invite" && onInvite ? (
          <button className="primary" onClick={onInvite}>
            {step.label} →
          </button>
        ) : (
          <Link className="buttonlike forest" href={step.href}>
            {step.label} →
          </Link>
        )}
      </div>
    </section>
  );
}
