"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "./provider";
import { ProjectTabs } from "./project-navigation";
import { Heading, Badge, Empty, EmptyState, Modal, FormMessage, useTask, Notice } from "./ui";
import { agreementGuidance } from "@/lib/agreement-guidance";
import {
  memberRole,
  latestAgreement,
  agreementMilestones,
  milestoneCriteria,
  bothAccepted,
  money,
  validateAgreement,
} from "@/lib/domain";
import { getSupabase } from "@/lib/supabase";
import { rpc } from "@/lib/cloud";
import type { Agreement, MilestoneDraft, Project } from "@/lib/types";
import { AgreementDraftBuilder } from "./agreement-draft-builder";
export function AgreementPage({ id, embedded = false, draftRequest, primaryDraftElsewhere = false }: { id: string; embedded?: boolean; draftRequest?: {projectId: string; sequence: number}; primaryDraftElsewhere?: boolean }) {
  const { data, user } = useWorkspace(),
    params = useSearchParams();
  const [editing, setEditing] = useState<{ base?: Agreement } | null>(null),
    [accepting, setAccepting] = useState<Agreement | null>(null);
  const p = data.projects.find((p) => p.id === id),
    role = memberRole(data, id, user?.id);
  const canOpenDraft = role === "client" && !!p && p.status !== "archived" && !data.agreementError && !data.agreements.some(a => a.project_id === id) && !params.has("version");
  useEffect(() => {
    if (draftRequest?.projectId === id && canOpenDraft) setEditing({});
  }, [draftRequest, id, canOpenDraft]);
  if (!p || !role) return <Empty>Project not found.</Empty>;
  if (data.agreementError)
    return (
      <>
        {!embedded && <ProjectTabs id={id} tab="agreement" />}
        <Empty>
          <h2>Agreements unavailable</h2>
          <p>{data.agreementError}</p>
          <p>Refresh to try loading again. If this persists, ask the project administrator to check access and database setup.</p>
          <a className="buttonlike" href="/setup/proofpay_002_agreements.sql" download>
            Download schema reference
          </a>
        </Empty>
      </>
    );
  const versions = data.agreements
      .filter((a) => a.project_id === id)
      .sort((a, b) => b.version - a.version),
    latest = versions[0];
  const requested = params.get("version");
  const a = editing ? editing.base : requested ? versions.find((a) => a.id === requested) : latest;
  const current = !!a && a.id === latest?.id,
    editable = role === "client" && p.status !== "archived";
  const guidance = agreementGuidance(data, p, user?.id);
  if (!a)
    return (
      <>
        {!embedded && <ProjectTabs id={id} tab="agreement" />}
        {!embedded && <Heading title="Agreement" />}
        {!embedded && !requested && !guidance.hasFreelancer && p.status !== "archived" && <EmptyState icon="user" title={guidance.teamTitle} description={guidance.teamDescription}>
          {guidance.canInvite && <Link className="buttonlike forest" href={guidance.teamHref}>{guidance.teamLabel} →</Link>}
        </EmptyState>}
        {primaryDraftElsewhere ? <p className="pw-context">Define scope, milestones and acceptance criteria. Both participants must accept the agreement before delivery.</p> : <EmptyState icon="report" title={requested ? "Agreement version not found." : embedded ? "Define the work and acceptance criteria" : "No agreement yet."}
          description={embedded && !requested && p.status !== "archived" ? "Both participants must accept the same agreement version before delivery; acceptance never authorizes payment." : requested ? "This version is not available to your account. Open the latest version to continue." : p.status === "archived" ? "This project is archived. Reopen an eligible draft from the project actions before adding an agreement." : role === "client"
            ? "Define scope, deliverables, milestones, amounts and acceptance requirements. You can save a draft before a freelancer joins. Both parties must accept the final version before delivery. Creating or accepting an agreement does not trigger payment."
            : "The client prepares the scope, deliverables, milestones, amounts and acceptance requirements. You both review and accept the latest version before delivery. Acceptance does not trigger payment."}>
          {guidance.canDraft && !requested && <button className={guidance.hasFreelancer ? "primary" : ""} onClick={() => setEditing({})}>Create agreement draft</button>}
          {p.status === "archived" && <Link href={`/projects/${id}`}>View project records →</Link>}
          {requested && <Link href={"/projects/" + id + "/agreement"}>Open latest version</Link>}
        </EmptyState>}
        {editing && (
          <AgreementEditor project={p} embedded={embedded} onClose={() => setEditing(null)} />
        )}
      </>
    );
  const approvals = data.approvals.filter((x) => x.agreement_id === a.id),
    milestones = agreementMilestones(data, a.id),
    own = approvals.some((x) => x.user_id === user?.id),
    hasFreelancer = data.members.some(
      (m) => m.project_id === id && m.role === "freelancer",
    );
  return (
    <>
      {!embedded && <ProjectTabs id={id} tab="agreement" />}
      <Heading
        level={embedded ? "h2" : "h1"}
        title="Agreement"
        subtitle={`${p.title} · Version ${a.version}${current ? "" : " · History"}`}
      >
        <div className="actions">
          {!embedded && current && bothAccepted(data, a.id) && (
            <Link className="buttonlike" href={"/projects/" + id + "/delivery"}>
              Open delivery →
            </Link>
          )}
          {editable && current && (
            <button onClick={() => setEditing({ base: latest })}>Create new version</button>
          )}
        </div>
      </Heading>
      {!hasFreelancer && p.status !== "archived" && <EmptyState icon="user" title={guidance.teamTitle} description={guidance.teamDescription}>
        {guidance.canInvite && <Link className="buttonlike forest" href={guidance.teamHref}>{guidance.teamLabel} →</Link>}
      </EmptyState>}
      {!milestones.length && <Notice>This version has no milestones. {role === "client" ? "Create a new version with at least one milestone before delivery." : "Ask the client to add milestones in a new version."}</Notice>}
      <div className="agreementlayout">
        <section>
          <div className="card">
            <div className="sectionhead">
              <h2>Scope</h2>
              <Badge status={bothAccepted(data, a.id) ? "approved" : ""}>
                {bothAccepted(data, a.id)
                  ? "Both accepted"
                  : hasFreelancer ? "Awaiting acceptance" : "Draft · freelancer needed"}
              </Badge>
            </div>
            <p className="preservelines">{a.scope}</p>
            {a.change_note && (
              <div className="changenote">
                <strong>Changes in this version</strong>
                <p className="preservelines">{a.change_note}</p>
              </div>
            )}
          </div>
          <div className="sectionhead">
            <h2>Milestones</h2>
            <span>
              {money(milestones.reduce((n, m) => n + Number(m.amount), 0))} ·
              USD
            </span>
          </div>
          {milestones.map((m) => (
            <section key={m.id} className="card milestonecard">
              <div className="sectionhead">
                <h2>
                  {m.position}. {m.title}
                </h2>
                <strong>{money(m.amount)}</strong>
              </div>
              <p className="subtle">Due {m.due_date}</p>
              <p className="preservelines">{m.description}</p>
              <ol className="criterialist">
                {milestoneCriteria(data, m.id).map((c) => (
                  <li key={c.id}>{c.description}</li>
                ))}
              </ol>
            </section>
          ))}
        </section>
        <aside>
          <section className="card">
            <h2>Acceptance</h2>
            {(["client", "freelancer"] as const).map((role) => {
              const accepted = approvals.find((x) => x.role === role);
              return (
                <div className="acceptancerow" key={role}>
                  <strong>{role === "client" ? "Client" : "Freelancer"}</strong>
                  <span>{accepted ? "Accepted" : "Pending"}</span>
                  {accepted && (
                    <small>
                      {new Date(accepted.approved_at).toLocaleString()}
                    </small>
                  )}
                </div>
              );
            })}
            {current && !own && hasFreelancer && p.status !== "archived" && (
              <button
                className="primary widebutton"
                onClick={() => setAccepting(a)}
              >
                Review & accept v{a.version}
              </button>
            )}
            <p className="fieldhelp">
              {!current
                ? "Historical version."
                : !hasFreelancer
                  ? "A freelancer must join before either party accepts."
                  : own
                    ? "You accepted this version."
                    : "Read every milestone before accepting."}{" "}
              Acceptance does not authorize a payment.
            </p>
          </section>
          <section className="card">
            <h2>Version history</h2>
            {versions.map((v) => (
              <Link
                key={v.id}
                className={`versionrow ${v.id === a.id ? "current" : ""}`}
                href={embedded ? `/projects/${id}?phase=setup&version=${encodeURIComponent(v.id)}` : "/projects/" + id + "/agreement?version=" + v.id}
              >
                <strong>
                  Version {v.version}
                  {v.id === latest.id ? " · Latest" : ""}
                </strong>
                <span>
                  {bothAccepted(data, v.id)
                    ? "Both accepted"
                    : "Awaiting acceptance"}
                </span>
              </Link>
            ))}
          </section>
        </aside>
      </div>
      {editing && (
        <AgreementEditor
          project={p}
          embedded={embedded}
          latest={editing.base}
          onClose={() => setEditing(null)}
        />
      )}
      {accepting && (
        <AcceptAgreement agreement={accepting} onClose={() => setAccepting(null)} />
      )}
    </>
  );
}
function AgreementEditor({
  project,
  latest: initialLatest,
  embedded = false,
  onClose,
}: {
  project: Project;
  latest?: Agreement;
  embedded?: boolean;
  onClose: () => void;
}) {
  const { data, refresh, notice } = useWorkspace(),
    task = useTask(),
    router = useRouter();
  // Keep the draft's base version fixed if a background refresh finds a new one.
  const [latest] = useState(initialLatest);
  const [scope, setScope] = useState(latest?.scope || project.description),
    [note, setNote] = useState("");
  const [items, setItems] = useState<MilestoneDraft[]>(() =>
    latest
      ? agreementMilestones(data, latest.id).map((m) => ({
          title: m.title,
          description: m.description,
          amount: Number(m.amount),
          due_date: m.due_date,
          criteria: milestoneCriteria(data, m.id).map((c) => c.description),
        }))
      : [
          {
            title: "",
            description: "",
            amount: Number(project.budget_amount),
            due_date: project.due_date || "",
            criteria: [""],
          },
        ],
  );
  function update(index: number, patch: Partial<MilestoneDraft>) {
    setItems((items) =>
      items.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  }
  return (
    <Modal
      title={latest ? "Create a new version" : "Create agreement draft"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleaned = items.map((m) => ({
            ...m,
            title: m.title.trim(),
            description: m.description.trim(),
            criteria: m.criteria.map((c) => c.trim()).filter(Boolean),
          }));
          void task.run(async () => {
            const issue = validateAgreement(
              scope,
              note,
              cleaned,
              Number(project.budget_amount),
              !!latest,
            );
            if (issue) throw Error(issue);
            const savedId = await rpc(getSupabase(), "create_agreement_version", {
              p_project_id: project.id,
              p_expected_agreement_id: latest?.id || null,
              p_scope: scope.trim(),
              p_change_note: note.trim(),
              p_milestones: cleaned,
            });
            await refresh();
            router.replace(embedded ? `/projects/${project.id}?phase=setup&version=${encodeURIComponent(savedId)}` : "/projects/" + project.id + "/agreement?version=" + savedId);
            notice("Agreement saved. Both parties can review this version.");
            onClose();
          });
        }}
      >
        <p className="dialogintro">
          {project.title} · {money(project.budget_amount)}
        </p>
        <label className="formlabel" htmlFor="scope">
          Scope of work
        </label>
        <textarea
          id="scope"
          className="field"
          required
          maxLength={10000}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
        <AgreementDraftBuilder
          project={project}
          scope={scope}
          disabled={task.busy}
          onApply={(draft) => {
            setScope(draft.scope);
            setItems([draft.milestone]);
          }}
        />
        {latest && (
          <>
            <label className="formlabel" htmlFor="change-note">
              What changed?
            </label>
            <textarea
              id="change-note"
              className="field"
              required
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        )}
        {items.map((m, i) => (
          <fieldset className="milestoneeditor" key={i}>
            <legend>Milestone {i + 1}</legend>
            <label className="formlabel" htmlFor={"m-title-" + i}>
              Title
            </label>
            <input
              className="field"
              id={"m-title-" + i}
              required
              maxLength={120}
              value={m.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <label className="formlabel" htmlFor={"m-desc-" + i}>
              Deliverable description
            </label>
            <textarea
              className="field"
              id={"m-desc-" + i}
              maxLength={5000}
              value={m.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
            <div className="formrow">
              <div>
                <label className="formlabel" htmlFor={"m-amount-" + i}>
                  Amount (USD)
                </label>
                <input
                  className="field"
                  id={"m-amount-" + i}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={m.amount}
                  onChange={(e) =>
                    update(i, { amount: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="formlabel" htmlFor={"m-due-" + i}>
                  Due date
                </label>
                <input
                  className="field"
                  id={"m-due-" + i}
                  type="date"
                  required
                  value={m.due_date}
                  onChange={(e) => update(i, { due_date: e.target.value })}
                />
              </div>
            </div>
            <label className="formlabel" htmlFor={"m-criteria-" + i}>
              Acceptance criteria · one per line
            </label>
            <textarea
              className="field"
              id={"m-criteria-" + i}
              aria-describedby={"m-criteria-help-" + i}
              required
              rows={3}
              value={m.criteria.join("\n")}
              onChange={(e) =>
                update(i, { criteria: e.target.value.split("\n") })
              }
            />
            <p className="fieldhelp" id={"m-criteria-help-" + i}>
              Write an observable result per line. For a website: Home, Product
              and Contact pages are present; the menu opens at 375 px; the
              contact form shows a success message; source code is delivered.
              Avoid subjective requirements such as “looks great.”
            </p>
            {items.length > 1 && (
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setItems((items) => items.filter((_, index) => index !== i))
                }
              >
                Remove milestone
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          disabled={items.length >= 20}
          onClick={() =>
            setItems([
              ...items,
              {
                title: "",
                description: "",
                amount: 0,
                due_date: "",
                criteria: [""],
              },
            ])
          }
        >
          + Add milestone
        </button>
        <p className="fieldhelp">
          Milestone total: {money(items.reduce((s, m) => s + m.amount, 0))} /{" "}
          {money(project.budget_amount)}
        </p>
        <label className="acceptancecheck">
          <input type="checkbox" required />
          Save for both parties to review. Changes require a new version and
          fresh acceptance.
        </label>
        <FormMessage error={task.error} />
        <div className="dialogfooter">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={task.busy}>
            Save version {(latest?.version || 0) + 1}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AcceptAgreement({
  agreement,
  onClose,
}: {
  agreement: Agreement;
  onClose: () => void;
}) {
  const { refresh, notice } = useWorkspace(),
    task = useTask();
  return (
    <Modal
      title={"Accept version " + agreement.version + "?"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await rpc(getSupabase(), "approve_agreement_version", {
              p_agreement_id: agreement.id,
            });
            await refresh();
            notice("Your acceptance was recorded.");
            onClose();
          });
        }}
      >
        <label className="acceptancecheck">
          <input type="checkbox" required />I reviewed and agree to the scope,
          milestones, dates, amounts and acceptance criteria in this version.
        </label>
        <p className="fieldhelp">No invoice or payment is created.</p>
        <FormMessage error={task.error} />
        <div className="dialogfooter">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={task.busy}>
            Accept version {agreement.version}
          </button>
        </div>
      </form>
    </Modal>
  );
}
