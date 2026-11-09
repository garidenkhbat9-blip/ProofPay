"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useWorkspace } from "./provider";
import { Empty, Notice } from "./ui";
import { ProjectActions } from "./project-actions";
import { AgreementPage } from "./agreement";
import { DeliveryPage, HandoffPage } from "./delivery";
import { ProjectPhaseNavigation } from "./project-navigation";
import {
  projectPhase,
  projectWorkspace,
  workspaceHref,
} from "@/lib/project-workspace";
import { pendingInvitations } from "@/lib/invitation-notifications";
import { money } from "@/lib/domain";
import { projectWaiting } from "@/lib/project-waiting";
import { ProjectWaiting } from "./project-waiting";
import "@/app/project-workspace.css";

export function ProjectWorkspace({
  id,
  setup,
  onInvite,
}: {
  id: string;
  setup?: ReactNode;
  onInvite?: () => void;
}) {
  const { data, user, refresh, setPerspective, error } = useWorkspace();
  const params = useSearchParams();
  const [clock, setClock] = useState(()=>Date.now());
  useEffect(()=>{
    const now=Date.now();
    const nextDay=Date.parse(new Date(now).toISOString().slice(0,10))+86400000;
    const expiry=Math.min(...data.invitations.filter(i=>i.project_id===id && i.status==="pending" && Date.parse(i.expires_at)>now).map(i=>Date.parse(i.expires_at)));
    const timer=setTimeout(()=>setClock(Date.now()),Math.max(1,Math.min(nextDay,expiry)-now+1));
    return ()=>clearTimeout(timer);
  },[id,data.invitations,clock]);
  const [legacyTeam, setLegacyTeam] = useState(false);
  const [draftRequest, setDraftRequest] = useState<{projectId: string; sequence: number}>();
  useEffect(() => {
    const update = () =>
      setLegacyTeam(window.location.hash === "#project-team");
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [id]);
  const displayNow = Date.now();
  const model = projectWorkspace(data, id, user?.id, displayNow);
  const waiting = projectWaiting(data, id, user?.id, displayNow);
  if (!model) {
    const invitation = pendingInvitations(data.invitations, user).find(
      (i) => i.project_id === id,
    );
    return invitation ? (
      <Empty>
        <h2>Project invitation</h2>
        <p>{invitation.project_title}</p>
        <Link className="buttonlike forest" href="/invitations">
          Review invitation to join
        </Link>
      </Empty>
    ) : (
      <Empty>Project not found.</Empty>
    );
  }
  const { project, rows } = model;
  const primary = waiting?.primary || model.primary;
  const primaryMilestone = rows.find(row=>row.milestone.id===waiting?.focus?.milestoneId)?.milestone || model.primaryMilestone;
  const selected =
    projectPhase(params.get("phase")) || (legacyTeam ? "setup" : primary.phase);
  const requestedLink = params.get("handoff");
  const draftHere = selected === "setup" && !model.agreement && model.role === "client" && !model.archived && !model.unavailable && !params.has("version") && data.members.some(m => m.project_id === id && m.role === "freelancer");
  const handoff =
    requestedLink &&
    data.links.find((l) => l.id === requestedLink && l.project_id === id);
  const historical = data.agreements
    .filter((a) => a.project_id === id && a.id !== model.agreement?.id)
    .sort((a, b) => b.version - a.version);
  return (
    <div className="project-workspace">
      <header className="pw-header">
        <div>
          <h1>{project.title}</h1>
          <p className="pw-participants">
            <span>Client: {model.participants("client")}</span>
            <span>Freelancer: {model.participants("freelancer")}</span>
            {project.due_date && <span>Due {project.due_date}</span>}
          </p>
        </div>
        <ProjectActions project={project} />
      </header>
      <section className="pw-focus" aria-label="Current stage and next action">
        <div>
          <span className="pw-eyebrow">
            {primary.priority ? "Next action" : "Current status"}
          </span>
          <h2>{primary.title}</h2>
          {primaryMilestone && (
            <p>
              {primaryMilestone.title} / Delivery date{" "}
              {primaryMilestone.due_date}
            </p>
          )}
          <p>Next: {primary.actor}</p>
          {waiting?.focus?.attention && <p className="pw-waiting-context">{waiting.focus.dateNote}</p>}
        </div>
        {model.unavailable ? (
          <button onClick={() => void refresh()}>Refresh status</button>
        ) : primary.invite && onInvite ? (
          <button className="primary" onClick={onInvite}>
            Invite
          </button>
        ) : draftHere ? (
          <button className="primary" onClick={() => setDraftRequest(previous => ({projectId: id, sequence: (previous?.sequence || 0) + 1}))}>Create agreement draft</button>
        ) : primary.href !== workspaceHref(id, selected, handoff ? handoff.id : undefined) || params.has("version") ? (
          <Link
            className="buttonlike pw-primary"
            href={primary.href.startsWith("#") ? primary.href : primary.href + "#project-phase-panel"}
          >
            {primary.label} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </section>
      <ProjectPhaseNavigation id={id} selected={selected} />
      {!!rows.length && <div className="pw-summary" aria-label="Current agreement progress">
        <span>{rows.length} milestone{rows.length === 1 ? "" : "s"}</span>
        <span>{model.unavailable ? "—" : model.submitted} in review</span>
        <span>{model.unavailable ? "—" : model.approved} approved</span>
        <span>
          {model.unavailable || data.paymentError ? "—" : model.paid} payment
          verified
        </span>
      </div>}
      {model.unavailable && (
        <Notice>
          Some project records are unavailable. Refresh before taking action.
        </Notice>
      )}
      {model.archived && (
        <Notice>
          This project is archived. Records are retained; new workflow actions
          are unavailable.
        </Notice>
      )}
      {!model.archived &&
        !model.unavailable &&
        !model.ready &&
        selected !== "setup" && (
          <Notice>
            Set up required: both participants must accept the latest agreement
            with milestones before delivery can continue.{" "}
            <Link href={workspaceHref(id, "setup")}>Review set up</Link>
          </Notice>
        )}
      <section
        className="pw-phase-panel"
        id="project-phase-panel"
        aria-label={`${selected} phase`}
      >
        {selected === "setup" && (
          <>
            <details className="pw-brief">
              <summary>
                Project brief & planned budget{" "}
                <span>{money(project.budget_amount)}</span>
              </summary>
              <p className="preservelines">
                {project.description || "No project brief added yet."}
              </p>
              <p>Planned budget is not funds held or payment collected.</p>
            </details>
            {setup}
            <AgreementPage id={id} embedded draftRequest={draftRequest} primaryDraftElsewhere={draftHere} />
          </>
        )}
        {(selected === "deliver" || selected === "review") && (
          <>
            <div className="pw-section-title">
              <h2>
                {selected === "deliver"
                  ? "Deliver work"
                  : "Review work"}
              </h2>
            </div>
            {requestedLink ? (
              handoff ? (
                <>
                  <Link
                    className="pw-secondary"
                    href={workspaceHref(id, selected)}
                  >
                    ← All milestones
                  </Link>
                  <HandoffPage key={handoff.id} id={handoff.id} embedded />
                </>
              ) : (
                <Notice>
                  This submission link is not available in this project.{" "}
                  <Link href={workspaceHref(id, selected)}>
                    View milestones
                  </Link>
                </Notice>
              )
            ) : selected === "deliver" ? (
              <DeliveryPage id={id} embedded />
            ) : (
              <>
                <div className="pw-milestones">
                  {rows.map((row) => (
                    <article key={row.milestone.id}>
                      <div>
                        <h3>{row.milestone.title}</h3>
                        <p>
                          {money(row.milestone.amount)} · Due{" "}
                          {row.milestone.due_date}
                        </p>
                        <span className="pw-status">{row.status}</span>
                      </div>
                      {row.evidenceLink ? (
                        <Link
                          href={workspaceHref(
                            id,
                            "review",
                            row.evidenceLink.id,
                          )}
                        >
                          {row.latest?.status === "submitted" &&
                          model.role === "client" &&
                          model.ready &&
                          !model.archived
                            ? "Review submission"
                            : "View evidence history"}{" "}
                          →
                        </Link>
                      ) : (
                        <span className="pw-muted">No submitted evidence</span>
                      )}
                    </article>
                  ))}
                </div>
                {!rows.length && (
                  <p className="pw-context">
                    Set up the agreement and milestones before review.
                  </p>
                )}
              </>
            )}
          </>
        )}
        {selected === "payment" && (
          <>
            <div className="pw-section-title">
              <h2>Payments</h2>
              <span>PayPal Sandbox</span>
            </div>
            {data.paymentError && <Notice>{data.paymentError}</Notice>}
            <div className="pw-milestones">
              {rows.map((row) => (
                <article key={row.milestone.id}>
                  <div>
                    <h3>{row.milestone.title}</h3>
                    <p>
                      {money(row.milestone.amount)} · Agreement v
                      {model.agreement?.version}
                    </p>
                  </div>
                  <span className="pw-status">
                    {model.unavailable
                      ? "Status unavailable"
                      : row.approved
                        ? row.status
                        : "Awaiting work approval"}
                  </span>
                </article>
              ))}
            </div>
            <Link
              className="buttonlike forest"
              href="/payments"
              onClick={() => setPerspective(model.role)}
            >
              View invoices →
            </Link>
          </>
        )}
      </section>
      {waiting && <ProjectWaiting model={waiting} stale={!!error} />}
      <details className="pw-history">
        <summary>Project records</summary>
        {selected !== "setup" && historical.map((a) => (
          <Link
            key={a.id}
            href={`/projects/${id}/agreement?version=${encodeURIComponent(a.id)}`}
          >
            Agreement v{a.version} — retained records
          </Link>
        ))}
        <Link href={`/projects/${id}/delivery`}>Full delivery records</Link>
      </details>
    </div>
  );
}
