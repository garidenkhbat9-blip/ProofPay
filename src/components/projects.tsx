"use client";
import Link from "next/link";
import { FreelancerOverview, MyJobsPage } from "./freelancer-workspace";
import { ClientOverview } from "./client-overview";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useInvitationNotifications } from "./invitation-notifications";
import { receivedInvitations } from "@/lib/invitation-notifications";
import { useWorkspace } from "./provider";
import {
  Heading,
  Empty,
  EmptyState,
  Badge,
  Icon,
  Notice,
  useTask,
  FormMessage,
  Modal,
} from "./ui";
import {
  categories,
  money,
  memberRole,
  invitationStatus,
  latestAgreement,
  bothAccepted,
} from "@/lib/domain";
import { getSupabase } from "@/lib/supabase";
import { rpc } from "@/lib/cloud";
import type { Project, Invitation } from "@/lib/types";
import { projectNextStep } from "@/lib/project-workflow";
import { ProjectWorkspace } from "./project-workspace";
import { ProjectActions } from "./project-actions";
import { projectTeam, workspaceProjects } from "@/lib/project-management";
export { ProjectTabs } from "./project-navigation";
function ProjectList({ projects }: { projects: Project[] }) {
  const { data, user } = useWorkspace();
  return projects.length ? (
    <div className="managed-project-list">
      {projects.map((p) => {
        const next = projectNextStep(data, p, user?.id);
        const team = projectTeam(data, p.id);
        return (
          <article className="managed-project" key={p.id}>
            <Link className="managed-project-main" href={"/projects/" + p.id}>
            <div className="managed-project-title">
              <h3>{p.title}</h3>
              <p>
                {categories[p.work_category]} ·{" "}
                {p.due_date ? "Due " + p.due_date : "No due date"}
              </p>
            </div>
            <div className="managed-project-budget"><small>Planned budget</small><strong>{money(p.budget_amount)}</strong></div>
            <div className="managed-project-state"><Badge status={p.status === "archived" ? "archived" : next?.attention ? "pending" : ""}>{next?.status || p.status}</Badge></div>
            <dl className="managed-project-team"><div><dt>Freelancer</dt><dd>{team.freelancer}</dd></div><div><dt>Invitation</dt><dd className="invitation-state">{team.invitation}</dd></div></dl>
            <p className="managed-project-next"><span>Next</span> {next?.title || "View project records"}<span aria-hidden="true"> →</span></p>
            </Link>
            <ProjectActions project={p} />
          </article>
        );
      })}
    </div>
  ) : (
    <Empty><h2>No matching projects</h2><p>Try a different search or filter. Projects appear here after you create one or accept an invitation.</p></Empty>
  );
}
export function ProjectsPage() {
  const { perspective } = useWorkspace();
  return perspective === "freelancer" ? <MyJobsPage /> : <ClientProjectsPage />;
}
function ClientProjectsPage() {
  const { data, user, perspective } = useWorkspace();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all");
  const owned = workspaceProjects(data, user?.id, perspective);
  const projects = owned.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (category === "all" || p.work_category === category) &&
      (status === "all" || (status === "open" ? p.status !== "archived" : p.status === "archived")),
  );
  return (
    <>
      <Heading
        title={perspective === "client" ? "Projects" : "My jobs"}
        subtitle="Every agreement, deliverable and decision."
      >
        {perspective === "client" && (
          <Link className="buttonlike forest" href="/projects/new">
            + New project
          </Link>
        )}
      </Heading>
      <div className="project-filters">
        <input
          className="field"
          aria-label="Search projects"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="field"
          aria-label="Work category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {Object.entries(categories).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <select className="field" aria-label="Project status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option><option value="open">Open projects</option><option value="archived">Archived</option>
        </select>
      </div>
      <p className="project-result-count" role="status">{projects.length} of {owned.length} {perspective === "client" ? "projects" : "jobs"}</p>
      <ProjectList projects={projects} />
    </>
  );
}
export function Dashboard({ projectIds = [] }: { projectIds?: string[] }) {
  const { perspective } = useWorkspace();
  return perspective === "client" ? <ClientOverview projectIds={projectIds} /> : <FreelancerOverview projectIds={projectIds} />;
}
export function NewProject() {
  const { perspective, refresh, notice } = useWorkspace();
  const router = useRouter(),
    task = useTask();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void task.run(async () => {
      const title = String(f.get("title")).trim();
      if (!title) throw Error("Enter a project name.");
      const id = await rpc(getSupabase(), "create_project", {
        p_title: title,
        p_description: String(f.get("description")).trim(),
        p_work_category: f.get("category"),
        p_budget_amount: Number(f.get("budget")),
        p_due_date: f.get("due") || null,
      });
      await refresh();
      router.push("/projects/" + id);
      notice("Project saved.");
    });
  }
  return (
    <>
      <Heading title="New project" subtitle="Start with a clear brief." />
      {perspective !== "client" ? (
        <Empty>Switch to Client view to create a project.</Empty>
      ) : (
        <form className="delivery-panel form-width" onSubmit={submit}>
          <label className="formlabel" htmlFor="title">
            Project name
          </label>
          <input
            className="field"
            id="title"
            name="title"
            required
            maxLength={120}
          />
          <label className="formlabel" htmlFor="description">
            Brief
          </label>
          <textarea
            className="field"
            id="description"
            name="description"
            required
            maxLength={10000}
            rows={4}
          />
          <div className="formrow">
            <div>
              <label className="formlabel" htmlFor="category">
                Work type
              </label>
              <select className="field" name="category" id="category">
                {Object.entries(categories).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="formlabel" htmlFor="budget">
                Planned budget (USD)
              </label>
              <input
                className="field"
                id="budget"
                name="budget"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                defaultValue="0"
                required
              />
            </div>
          </div>
          <label className="formlabel" htmlFor="due">
            Due date (optional)
          </label>
          <input className="field" id="due" name="due" type="date" />
          <FormMessage error={task.error} />
          <div className="actions">
            <Link className="buttonlike" href="/projects">
              Cancel
            </Link>
            <button className="primary" disabled={task.busy}>
              {task.busy ? "Saving…" : "Create project"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
export function ProjectOverview({ id }: { id: string }) {
  const { data, user } = useWorkspace();
  const [invite, setInvite] = useState(false);
  const p = data.projects.find(p => p.id === id);
  const role = memberRole(data, id, user?.id);
  if (!p || !role) return <ProjectWorkspace id={id} />;
  const hasFreelancer = data.members.some(m => m.project_id === id && m.role === "freelancer");
  const invitations = data.invitations.filter(i => i.project_id === id);
  const pending = invitations.filter(i => invitationStatus(i) === "pending");
  const history = invitations.filter(i => invitationStatus(i) !== "pending");
  return <>
    <ProjectWorkspace id={id} onInvite={() => setInvite(true)} setup={
      <section className="pw-team" id="project-team">
        <h2>Team & invitation</h2>
        {role === "client" ? data.invitationError ? <p>Invitation records unavailable.</p> : <>{pending.length > 0 && <InvitationList items={pending} incoming={false} showProject={false} />}{history.length > 0 && <details><summary>Previous invitations ({history.length})</summary><InvitationList items={history} incoming={false} showProject={false} /></details>}{!invitations.length && <p>No invitation sent.</p>}</> : <p>Your project membership is confirmed.</p>}
        {role === "client" && !hasFreelancer && p.status !== "archived" && data.invitations.some(i => i.project_id === id && invitationStatus(i) === "pending") && <button onClick={() => setInvite(true)}>Manage invitation recipient</button>}
      </section>
    } />
    {invite && <InviteForm project={p} onClose={() => setInvite(false)} />}
  </>;
}
function InviteForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { user, refresh, notice } = useWorkspace();
  const task = useTask();
  return (
    <Modal title="Invite a freelancer" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email"))
            .trim()
            .toLowerCase();
          void task.run(async () => {
            if (email === user?.email?.toLowerCase())
              throw Error("Use the freelancer’s email, not your own.");
            await rpc(getSupabase(), "invite_freelancer", {
              p_project_id: project.id,
              p_email: email,
            });
            await refresh();
            notice(
              "Invitation created. Ask the recipient to sign in and open Invitations. No email was sent.",
            );
            onClose();
          });
        }}
      >
        <p className="dialogintro">{project.title}</p>
        <label className="formlabel" htmlFor="invite-email">
          Freelancer email
        </label>
        <input
          className="field"
          id="invite-email"
          name="email"
          type="email"
          required
          maxLength={254}
        />
        <p className="fieldhelp">
          Use their verified email. No email is sent. A new invitation replaces
          a pending invitation for this project.
        </p>
        <FormMessage error={task.error} />
        <div className="dialogfooter">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={task.busy}>
            Create invitation
          </button>
        </div>
      </form>
    </Modal>
  );
}
function InvitationList({
  items,
  incoming,
  showProject = true,
}: {
  items: Invitation[];
  incoming: boolean;
  showProject?: boolean;
}) {
  const { data, user, refresh, refreshChecked, notice, setPerspective } = useWorkspace();
  const { items: actionable } = useInvitationNotifications();
  const router = useRouter(),
    task = useTask();
  const [selected, setSelected] = useState<Invitation | null>(null);
  const currentSelection = selected && items.find(i => i.id === selected.id);
  const canConfirm = !!currentSelection && (incoming ? actionable.some(i => i.id === currentSelection.id) : currentSelection.status === "pending");
  return (
    <>
      {items.length ? (
        items.map((i) => {
          const status = invitationStatus(i),
            own = memberRole(data, i.project_id, user?.id);
          const can = incoming
            ? actionable.some(item => item.id === i.id)
            : own === "client" && i.status === "pending";
          return (
            <article className="invitationrow" key={i.id}>
              <div className="invitationinfo">
                <strong>{i.project_title}</strong>
                {!incoming && <p>{i.invited_email}</p>}
                <small>
                  {status === "expired" ? "Expired" : "Expires"} {new Date(i.expires_at).toLocaleString()}
                </small>
                {status === "expired" && <p>This invitation has expired. Ask the client for a new invitation.</p>}
                {status === "revoked" && <p>The client revoked this invitation. It can no longer be accepted.</p>}
              </div>
              <div className="invitationactions">
                <Badge status={status === "accepted" ? "approved" : status}>
                  {status}
                </Badge>
                {can && (
                  <button onClick={() => setSelected(i)}>
                    {incoming ? "Review invitation" : "Revoke"}
                  </button>
                )}
                {own && showProject && (
                  <Link
                    className="buttonlike"
                    href={"/projects/" + i.project_id}
                  >
                    View project
                  </Link>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="subtle">No invitations yet.</p>
      )}
      {selected && (
        <Modal
          title={incoming ? "Join this project?" : "Revoke invitation?"}
          onClose={() => setSelected(null)}
        >
          <p className="dialogintro">{selected.project_title}</p>
          <p>
            {incoming
              ? "You will join as the freelancer. This does not approve an agreement or authorize a payment."
              : "The recipient will no longer be able to accept this invitation."}
          </p>
          {!canConfirm && <Notice>This invitation is no longer actionable. It may have expired or been revoked. Close this review and check the updated list.</Notice>}
          <FormMessage error={task.error} />
          <div className="dialogfooter">
            <button onClick={() => setSelected(null)}>Cancel</button>
            <button
              className="primary"
              disabled={task.busy || !canConfirm}
              onClick={() =>
                void task.run(async () => {
                  if (!canConfirm) return;
                  const projectId = await rpc(
                    getSupabase(),
                    incoming
                      ? "accept_project_invitation"
                      : "revoke_project_invitation",
                    { p_invitation_id: selected.id },
                  ).catch(async (error: unknown) => {
                    // A revoke/expiry may have raced the review. Reconcile the
                    // visible list even when the server correctly rejects it.
                    await refresh();
                    throw error;
                  });
                  try {
                    await refreshChecked();
                  } catch {
                    // The mutation was confirmed even if its follow-up read
                    // failed. Do not suggest resubmitting the same decision.
                    setSelected(null);
                    notice(incoming
                      ? "Invitation accepted. Refresh the workspace to update your invitations."
                      : "Invitation revoked. Refresh the workspace to update your invitations.");
                    return;
                  }
                  setSelected(null);
                  if (incoming) {
                    setPerspective("freelancer");
                    router.push("/projects/" + projectId);
                  }
                  notice(
                    incoming
                      ? "You joined as the freelancer."
                      : "Invitation revoked.",
                  );
                })
              }
            >
              {incoming ? "Accept invitation" : "Revoke invitation"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function InvitationsPage() {
  const { data, user, refresh, loading } = useWorkspace();
  const { items, count } = useInvitationNotifications();
  const received = receivedInvitations(data.invitations, user);
  const history = received.filter(i => !items.some(p => p.id === i.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sent = data.invitations.filter(i => memberRole(data, i.project_id, user?.id) === "client");
  return <div className="invitation-workspace">
    <Heading title="Invitations" subtitle="Review the project before you join."><button disabled={loading} onClick={() => void refresh()}>{loading ? "Refreshing..." : "Refresh"}</button></Heading>
    {data.invitationError ? <Notice>Invitations are unavailable. Refresh to try again.</Notice> : <>
      <section className="invitation-panel" aria-labelledby="pending-invitations-title"><h2 id="pending-invitations-title">Pending invitations {count === null ? "" : `(${count})`}</h2>
      {count === null ? <p role="status">Loading invitations...</p> : count ? <InvitationList incoming items={items} /> : <div className="invitation-empty"><Icon name="check" /><p>No pending invitations.</p></div>}</section>
      {history.length > 0 && <details><summary>Invitation history ({history.length})</summary><section className="invitation-panel"><InvitationList incoming items={history} /></section></details>}
      {sent.length > 0 && <details><summary>Sent invitations ({sent.length})</summary><section className="invitation-panel"><InvitationList incoming={false} items={sent} /></section></details>}
    </>}
    <details><summary>How invitations work</summary><p>Invitations are matched to your verified email. Joining does not accept an agreement or authorize payment. Updates appear in ProofPay; email and push delivery are not connected.</p></details>
  </div>;
}
export function AgreementsList() {
  const { data, user, perspective } = useWorkspace();
  const projects = workspaceProjects(data, user?.id, perspective);
  return (
    <>
      <Heading title="Agreements" />
      {!data.agreementError && !projects.length && <EmptyState icon="report" title="No agreements yet."
        description={perspective === "client" ? "Create a project to define scope, deliverables, milestones and acceptance requirements. Agreements do not trigger payment." : "After you join a project, the client's agreement appears here for your review. Accepting it does not trigger payment."}>
        <Link className="buttonlike forest" href={perspective === "client" ? "/projects/new" : "/invitations"}>{perspective === "client" ? "Create project" : "View invitations"}</Link>
      </EmptyState>}
      <div className="delivery-list">
        {data.agreementError ? (
          <Empty>Agreement setup is unavailable: {data.agreementError}</Empty>
        ) : (
          projects
            .map((p) => {
              const a = latestAgreement(data, p.id);
              return (
                <Link
                  className="delivery-row"
                  href={"/projects/" + p.id + "/agreement"}
                  key={p.id}
                >
                  <div>
                    <h3>{p.title}</h3>
                    <p>{a ? "Version " + a.version : "No agreement yet"}</p>
                  </div>
                  <Badge
                    status={a && bothAccepted(data, a.id) ? "approved" : ""}
                  >
                    {a
                      ? bothAccepted(data, a.id)
                        ? "Both accepted"
                        : "Awaiting acceptance"
                      : "Not created"}
                  </Badge>
                  <span>→</span>
                </Link>
              );
            })
        )}
      </div>
    </>
  );
}
