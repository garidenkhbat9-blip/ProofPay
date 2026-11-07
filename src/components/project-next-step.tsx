"use client";
import Link from "next/link";
import { type ProjectNextStep } from "@/lib/project-workflow";

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
        {step.stages?.map((stage, index) => (
          <li
            key={stage.label}
            aria-current={stage.state === "current" ? "step" : undefined}
            className={stage.state}
            title={stage.detail}
          >
            <span aria-hidden="true">
              {stage.state === "complete" ? "✓" : index + 1}
            </span>
            <div>
              {stage.label}
              <small>
                {
                  {
                    complete: "Complete",
                    current: "Current",
                    blocked: "Blocked",
                    not_started: "Not started",
                  }[stage.state]
                }
              </small>
            </div>
          </li>
        ))}
      </ol>
      <div className="project-next-body">
        <div>
          <p className="project-next-status">{step.status}</p>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
          <p className="workflow-actor">Next: {step.actor}</p>
          {step.blocker && <p className="workflow-blocker">{step.blocker}</p>}
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
