"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useWorkspace } from "./provider";
import {
  Heading,
  Empty,
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
  currentDeliveries,
} from "@/lib/domain";
import { getSupabase } from "@/lib/supabase";
import { rpc } from "@/lib/cloud";
import type { Project, Invitation } from "@/lib/types";
import { projectNextStep } from "@/lib/project-workflow";
import { ProjectNextAction } from "./project-next-step";
import { dashboardGuidance, workspaceIdentity } from "@/lib/workspace-onboarding";
import { WorkspaceOnboarding, WorkflowHelp } from "./workspace-onboarding";
import { JudgeWorkspace } from "./judge-workspace";
export function ProjectTabs({
  id,
  tab,
}: {
  id: string;
  tab: "overview" | "agreement" | "delivery";
}) {
  return (
    <nav className="projecttabs" aria-label="Project sections">
      {(["overview", "agreement", "delivery"] as const).map((t) => (
        <Link
          key={t}
          href={"/projects/" + id + (t === "overview" ? "" : "/" + t)}
          className={tab === t ? "selected" : ""}
        >
          {t[0].toUpperCase() + t.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
function ProjectList({ projects }: { projects: Project[] }) {
  const { data, user } = useWorkspace();
  return projects.length ? (
    <div className="delivery-list">
      {projects.map((p) => {
        const next = projectNextStep(data, p, user?.id);
        return (
          <Link className="delivery-row" href={"/projects/" + p.id} key={p.id}>
            <div>
              <h3>{p.title}</h3>
              <p>
                {categories[p.work_category]} ·{" "}
                {p.due_date ? "Due " + p.due_date : "No due date"}
              </p>
            </div>
            <Badge>{next?.status || "Project"}</Badge>
            <strong>{money(p.budget_amount)}</strong>
            <span>→</span>
          </Link>
        );
      })}
    </div>
  ) : (
    <Empty>No projects in this perspective yet.</Empty>
  );
}
export function ProjectsPage() {
  const { data, user, perspective } = useWorkspace();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const projects = data.projects.filter(
    (p) =>
      memberRole(data, p.id, user?.id) === perspective &&
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (category === "all" || p.work_category === category),
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
      </div>
      <ProjectList projects={projects} />
    </>
  );
}
export function Dashboard({ projectIds = [] }: { projectIds?: string[] }) {
  const { data, user, perspective, refresh, setPerspective } = useWorkspace();
  const { projects, actions: nextActions, pendingInvitation: hasPending, otherPerspective, otherProjects } = dashboardGuidance(data, user, perspective);
  const { greeting } = workspaceIdentity(user, data.profiles);
  const progressUnavailable = !!(data.agreementError || data.deliveryError);
  const current = currentDeliveries(
    data,
    projects.map((p) => p.id),
  );
  const waiting = current.filter((s) => s.status === "submitted").length;
  const approved = current.filter((s) => s.status === "approved").length;
  const changesReq = current.filter((s) => s.status === "changes").length;
  const totalBudget = projects.reduce(
    (sum, p) => sum + Number(p.budget_amount),
    0,
  );
  const hasProjects = projects.length > 0;
  return (
    <>
      {hasProjects && <div className="dash-welcome">
        <span className="judge-eyebrow">{perspective === "client" ? "CLIENT" : "FREELANCER"} WORKSPACE</span>
        <h1>{greeting}</h1>
        <p>
          {perspective === "client"
            ? "Your projects and the work ready for your review."
            : "Your work, delivery updates and next steps."}
        </p>
      </div>}
      {data.invitationError && <Notice>Invitation status is unavailable. <button onClick={() => void refresh()}>Refresh workspace</button></Notice>}
      {progressUnavailable && <Notice>Some agreement or delivery records could not be loaded. Progress is unavailable until these records are restored. <button onClick={() => void refresh()}>Refresh workspace</button></Notice>}
      {!hasProjects && otherProjects.length > 0 && <Notice>You have {otherProjects.length} project{otherProjects.length === 1 ? "" : "s"} as a {otherPerspective === "client" ? "Client" : "Freelancer"} with this account. <button onClick={() => setPerspective(otherPerspective)}>View {otherPerspective === "client" ? "Client" : "Freelancer"} projects</button></Notice>}
      {hasPending && hasProjects && (
        <Link className="invitationnotice" href="/invitations">
          You have a pending project invitation. Review invitation →
        </Link>
      )}
      {!hasProjects ? (
        <WorkspaceOnboarding perspective={perspective} pendingInvitation={hasPending} />
      ) : (
        <>
          {nextActions[0] && <section className="dashboard-next" aria-labelledby="dashboard-next-title">
            <div><span className="judge-eyebrow">{nextActions[0].step.attention ? "YOUR NEXT ACTION" : "CURRENT PROJECT STATUS"}</span>
              <p className="dashboard-next-project">{nextActions[0].project.title}</p>
              <h2 id="dashboard-next-title">{nextActions[0].step.title}</h2>
              <p>{nextActions[0].step.description}</p></div>
            <Link className="buttonlike forest" href={nextActions[0].step.href}>{nextActions[0].step.label} <span aria-hidden="true">→</span></Link>
          </section>}
          <div className="dash-stats">
            <div className="dash-stat">
              <div className="dash-stat-label">
                Active projects
                <Icon name="folder" />
              </div>
              <div className="dash-stat-value">
                {projects.filter((p) => p.status !== "archived").length}
              </div>
              <div className="dash-stat-foot">
                {projects.filter((p) => p.status === "archived").length}{" "}
                archived
              </div>
            </div>
            <div className="dash-stat">
              <div className="dash-stat-label">
                {perspective === "client" ? "To review" : "Awaiting review"}
                <Icon name="clock" />
              </div>
              <div className="dash-stat-value">{progressUnavailable ? "—" : waiting}</div>
              <div className="dash-stat-foot">
                {progressUnavailable ? "Status unavailable" : changesReq > 0
                  ? changesReq + " changes requested"
                  : "No changes requested"}
              </div>
            </div>
            <div className="dash-stat">
              <div className="dash-stat-label">
                Approved
                <Icon name="check" />
              </div>
              <div className="dash-stat-value">{progressUnavailable ? "—" : approved}</div>
              <div className="dash-stat-foot">work accepted · not payment</div>
            </div>
            <div className="dash-stat">
              <div className="dash-stat-label">
                Planned budget
                <Icon name="wallet" />
              </div>
              <div className="dash-stat-value">{money(totalBudget)}</div>
              <div className="dash-stat-foot">USD · planned, not collected</div>
            </div>
          </div>
          <div className="dash-grid">
            <div>
              {nextActions.length > 0 && (
                <div className="dash-section" style={{ marginBottom: 20 }}>
                  <div className="dash-section-head">
                    <h2>Project next steps</h2>
                    <span>
                      {nextActions.length} project
                      {nextActions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {nextActions.slice(0, 5).map(({ project, step }) => (
                    <Link
                      className="dash-action"
                      href={step.href}
                      key={project.id}
                    >
                      <div
                        className={`dash-action-icon ${step.attention ? "attention" : ""}`}
                      >
                        <Icon name={step.attention ? "clock" : "folder"} />
                      </div>
                      <div>
                        <strong>{project.title}</strong>
                        <p>{step.title}</p>
                        <Badge>{step.status}</Badge>
                      </div>
                      <span>{step.label} →</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="dash-section">
                <div className="dash-section-head">
                  <h2>
                    {perspective === "client" ? "Your projects" : "My jobs"}
                  </h2>
                  <button className="ghost" onClick={() => void refresh()}>
                    Refresh
                  </button>
                </div>
                {projects.length ? (
                  projects.map((p) => {
                    const next = projectNextStep(data, p, user?.id);
                    return (
                      <Link
                        className="dash-project-row"
                        href={"/projects/" + p.id}
                        key={p.id}
                      >
                        <div className="dash-project-icon">
                          <Icon name="folder" />
                        </div>
                        <div>
                          <strong>{p.title}</strong>
                          <p>
                            {categories[p.work_category]} ·{" "}
                            {p.due_date ? "Due " + p.due_date : "No due date"}
                          </p>
                        </div>
                        <span>{money(p.budget_amount)}</span>
                      </Link>
                    );
                  })
                ) : (
                  <div className="dash-empty-row">No projects yet.</div>
                )}
              </div>
            </div>
            <aside>
              <div className="dash-aside-card">
                <h3>Delivery progress</h3>
                {progressUnavailable ? <p>Delivery progress is unavailable. Refresh your workspace to try again.</p> : current.length ? (
                  <>
                    {(
                      [
                        ["approved", "Approved", approved],
                        ["submitted", "In review", waiting],
                        ["changes", "Changes requested", changesReq],
                      ] as const
                    ).map(([cls, label, count]) => (
                      <div className="dash-delivery-bar" key={cls}>
                        <div>
                          <span>{label}</span>
                          <strong>{count}</strong>
                        </div>
                        <div className="dash-bar-track">
                          <span
                            className={cls}
                            style={{
                              width:
                                (current.length
                                  ? (100 * count) / current.length
                                  : 0) + "%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    Progress appears after the first submission.
                  </p>
                )}
                <div className="dash-tip">
                  <Icon name="shield" />
                  Approval records acceptance. Payment is a separate step.
                </div>
              </div>
              {perspective === "client" && (
                <div className="dash-aside-card">
                  <h3>Quick actions</h3>
                  <Link
                    className="buttonlike widebutton"
                    href="/projects/new"
                    style={{ display: "flex", fontSize: 13 }}
                  >
                    + New project
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      <JudgeWorkspace projectIds={projectIds} />
      <WorkflowHelp />
    </>
  );
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
  const p = data.projects.find((p) => p.id === id);
  if (!p || !memberRole(data, id, user?.id))
    return <Empty>Project not found.</Empty>;
  const role = memberRole(data, id, user?.id);
  const next = projectNextStep(data, p, user?.id);
  const person = (r: string) => {
    const m = data.members.find((m) => m.project_id === id && m.role === r);
    return m
      ? data.profiles.find((p) => p.id === m.user_id)?.full_name ||
          "Project member"
      : "Not assigned";
  };
  return (
    <>
      <ProjectTabs id={id} tab="overview" />
      <Heading title={p.title} />
      {next && (
        <ProjectNextAction step={next} onInvite={() => setInvite(true)} />
      )}
      <section className="card">
        <h2>Project brief</h2>
        <p className="preservelines">{p.description}</p>
        <dl className="details sectionspace">
          {[
            ["Planned budget", money(p.budget_amount)],
            ["Your role", role],
            ["Client", person("client")],
            ["Freelancer", person("freelancer")],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card" id="project-team">
        <div className="sectionhead">
          <h2>Project team</h2>
          {role === "client" &&
            person("freelancer") === "Not assigned" &&
            p.status !== "archived" && (
              <button onClick={() => setInvite(true)}>
                + Invite freelancer
              </button>
            )}
        </div>
        <p>Freelancer: {person("freelancer")}</p>
        {role === "client" && (
          <InvitationList
            items={data.invitations.filter((i) => i.project_id === id)}
            incoming={false}
          />
        )}
      </section>
      {invite && <InviteForm project={p} onClose={() => setInvite(false)} />}
    </>
  );
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
}: {
  items: Invitation[];
  incoming: boolean;
}) {
  const { data, user, refresh, notice, setPerspective } = useWorkspace();
  const router = useRouter(),
    task = useTask();
  const [selected, setSelected] = useState<Invitation | null>(null);
  return (
    <>
      {items.length ? (
        items.map((i) => {
          const status = invitationStatus(i),
            own = memberRole(data, i.project_id, user?.id);
          const can = incoming
            ? i.invited_email === user?.email?.trim().toLowerCase() &&
              status === "pending"
            : own === "client" && i.status === "pending";
          return (
            <article className="invitationrow" key={i.id}>
              <div className="invitationinfo">
                <strong>{i.project_title}</strong>
                <p>{i.invited_email}</p>
                <small>
                  Expires {new Date(i.expires_at).toLocaleDateString()}
                </small>
              </div>
              <div className="invitationactions">
                <Badge status={status === "accepted" ? "approved" : ""}>
                  {status}
                </Badge>
                {can && (
                  <button onClick={() => setSelected(i)}>
                    {incoming ? "Review invitation" : "Revoke"}
                  </button>
                )}
                {own && (
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
          <FormMessage error={task.error} />
          <div className="dialogfooter">
            <button onClick={() => setSelected(null)}>Cancel</button>
            <button
              className="primary"
              disabled={task.busy}
              onClick={() =>
                void task.run(async () => {
                  const projectId = await rpc(
                    getSupabase(),
                    incoming
                      ? "accept_project_invitation"
                      : "revoke_project_invitation",
                    { p_invitation_id: selected.id },
                  );
                  await refresh();
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
  const { data, user, refresh } = useWorkspace();
  return (
    <>
      <Heading title="Invitations">
        <button onClick={() => void refresh()}>Refresh</button>
      </Heading>
      <p className="subtle">
        Invitations match a verified email address. No email is sent.
      </p>
      {data.invitationError && <Notice>{data.invitationError}</Notice>}
      <section className="card">
        <h2>Received</h2>
        <InvitationList
          incoming
          items={data.invitations.filter(
            (i) => i.invited_email === user?.email?.toLowerCase(),
          )}
        />
      </section>
      <section className="card">
        <h2>Created by you</h2>
        <InvitationList
          incoming={false}
          items={data.invitations.filter(
            (i) => memberRole(data, i.project_id, user?.id) === "client",
          )}
        />
      </section>
    </>
  );
}
export function AgreementsList() {
  const { data, user, perspective } = useWorkspace();
  return (
    <>
      <Heading title="Agreements" />
      <div className="delivery-list">
        {data.agreementError ? (
          <Empty>Agreement setup is unavailable: {data.agreementError}</Empty>
        ) : (
          data.projects
            .filter((p) => memberRole(data, p.id, user?.id) === perspective)
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
                      : "Draft"}
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
