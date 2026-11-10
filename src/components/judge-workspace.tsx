"use client";
import Link from "next/link";
import { useWorkspace } from "./provider";
import { judgeProjects, judgeProgress } from "@/lib/judge-access";

export function JudgeWorkspace({ projectIds }: { projectIds: string[] }) {
  const { data, user, perspective, error } = useWorkspace();
  const projects = judgeProjects(data, projectIds, user?.id, perspective);
  if (!projectIds.length || !projects.length || error) return null;
  return <details className="workflow-help">
    <summary>Prepared Sandbox projects</summary>
    <div>
      <p>Real project records for this account. PayPal Sandbox payments are test payments.</p>
      {projects.map((project) => {
        const progress = judgeProgress(data, project.id);
        return <div key={project.id} className="prepared-project">
          <Link href={`/projects/${project.id}`}>{project.title}</Link>
          <dl>
            <div><dt>Agreement</dt><dd>{progress.agreement}</dd></div>
            <div><dt>Evidence</dt><dd>{progress.evidence}</dd></div>
            <div><dt>Review</dt><dd>{progress.review}</dd></div>
          </dl>
        </div>;
      })}
      <Link href="/payments">View recorded payment status</Link>
    </div>
  </details>;
}
