"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createEvidenceFinalizer } from "@/lib/evidence-submit";
import { useWorkspace } from "./provider";
import { ProjectTabs } from "./projects";
import {
  Heading,
  Badge,
  Empty,
  Notice,
  Modal,
  FormMessage,
  useTask,
} from "./ui";
import {
  activeLink,
  reviewable,
  memberRole,
  latestAgreement,
  agreementMilestones,
  milestoneCriteria,
  bothAccepted,
  money,
  revisions,
  deliveryStatus,
  validateEvidence,
  safeUrl,
} from "@/lib/domain";
import { getSupabase } from "@/lib/supabase";
import { rpc, errorMessage } from "@/lib/cloud";
import type {
  Milestone,
  Submission,
  Criterion,
  SubmissionLink,
} from "@/lib/types";
function SetupNeeded({ error }: { error: string }) {
  return (
    <Empty>
      <h2>Delivery unavailable</h2>
      <p>{error}</p>
      <p>Refresh to try loading again. If this persists, ask the project administrator to check access and database setup.</p>
      <a className="buttonlike" href="/setup/proofpay_003_handoffs.sql" download>
        Download schema reference
      </a>
    </Empty>
  );
}
export function DeliveryPage({ id }: { id: string }) {
  const { data, user } = useWorkspace();
  const [create, setCreate] = useState<Milestone | null>(null);
  const p = data.projects.find((p) => p.id === id),
    role = memberRole(data, id, user?.id);
  if (!p || !role) return <Empty>Project not found.</Empty>;
  if (data.deliveryError || data.agreementError)
    return (
      <>
        <ProjectTabs id={id} tab="delivery" />
        <SetupNeeded error={data.deliveryError || data.agreementError} />
      </>
    );
  const a = latestAgreement(data, id),
    ready = p.status !== "archived" && a && bothAccepted(data, a.id);
  return (
    <>
      <ProjectTabs id={id} tab="delivery" />
      <Heading
        title={p.title}
        subtitle="A clear handoff. A recorded decision."
      />
      {!ready && (
        <Notice>
          Both parties must accept the latest agreement before delivery.{" "}
          <Link href={"/projects/" + id + "/agreement"}>Open agreement →</Link>
        </Notice>
      )}
      <div className="delivery-list">
        {(a ? agreementMilestones(data, a.id) : []).map((m, i) => {
          const last = revisions(data, m.id)[0],
            link = data.links.find(
              (l) => l.milestone_id === m.id && activeLink(data, l),
            ),
            view = link || data.links.find((l) => l.id === last?.link_id);
          return (
            <article className="delivery-row" key={m.id}>
              <span className="delivery-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{m.title}</h3>
                <p>
                  {money(m.amount)} · {milestoneCriteria(data, m.id).length}{" "}
                  requirements · Due {m.due_date}
                </p>
              </div>
              <Badge status={last?.status}>{deliveryStatus(last)}</Badge>
              <div className="actions">
                {view && (
                  <Link className="buttonlike" href={"/handoff/" + view.id}>
                    {role === "client" && last?.status === "submitted"
                      ? "Review work"
                      : "Open delivery"}{" "}
                    →
                  </Link>
                )}
                {ready &&
                  role === "client" &&
                  !link &&
                  !["submitted", "approved"].includes(last?.status || "") && (
                    <button onClick={() => setCreate(m)}>Create link</button>
                  )}
              </div>
            </article>
          );
        })}
        {!a && (
          <div className="empty">
            Add milestones to your agreement to begin.
          </div>
        )}
      </div>
      <p className="subtle sectionspace">
        Approval records acceptance. Payment is a separate step.
      </p>
      {create && (
        <CreateLink milestone={create} onClose={() => setCreate(null)} />
      )}
    </>
  );
}
function CreateLink({
  milestone,
  onClose,
}: {
  milestone: Milestone;
  onClose: () => void;
}) {
  const { refresh } = useWorkspace(),
    task = useTask(),
    router = useRouter();
  return (
    <Modal title="Create submission link" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void task.run(async () => {
            const id = await rpc(getSupabase(), "create_submission_link", {
              p_milestone_id: milestone.id,
              p_instructions: String(f.get("instructions") || "").trim(),
            });
            await refresh();
            onClose();
            router.push("/handoff/" + id);
          });
        }}
      >
        <p className="dialogintro">
          {milestone.title} · {money(milestone.amount)}
        </p>
        <label className="formlabel" htmlFor="instructions">
          Submission instructions
        </label>
        <textarea
          className="field"
          name="instructions"
          id="instructions"
          rows={4}
          maxLength={5000}
          placeholder="Upload the source files and include your live preview URL."
        />
        <p className="fieldhelp">
          Instructions explain how to submit. Change agreed requirements in a
          new agreement version.
        </p>
        <FormMessage error={task.error} />
        <div className="dialogfooter">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={task.busy}>
            Create link
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ReviewsPage() {
  const { data, user, perspective } = useWorkspace();
  if (data.deliveryError) return <SetupNeeded error={data.deliveryError} />;
  const list = data.submissions
    .filter(
      (s) =>
        memberRole(data, s.project_id, user?.id) === perspective &&
        s.status !== "uploading",
    )
    .sort(
      (a, b) =>
        Date.parse(b.submitted_at || b.created_at) -
        Date.parse(a.submitted_at || a.created_at),
    );
  return (
    <>
      <Heading
        title={perspective === "client" ? "Review inbox" : "My submissions"}
        subtitle="Evidence and decisions, in one place."
      />
      <div className="delivery-list">
        {list.map((s) => (
          <Link
            key={s.id}
            className="delivery-row"
            href={"/handoff/" + s.link_id + "?revision=" + s.revision}
          >
            <div>
              <h3>
                {data.milestones.find((m) => m.id === s.milestone_id)?.title}
              </h3>
              <p>
                {data.projects.find((p) => p.id === s.project_id)?.title} ·
                Revision {s.revision}
              </p>
            </div>
            <Badge status={s.status}>{deliveryStatus(s)}</Badge>
            <span>View →</span>
          </Link>
        ))}
        {!list.length && <div className="empty">No submissions yet.</div>}
      </div>
    </>
  );
}
export function HandoffPage({ id }: { id: string }) {
  const { data, user } = useWorkspace();
  if (data.deliveryError || data.agreementError)
    return <SetupNeeded error={data.deliveryError || data.agreementError} />;
  const link = data.links.find((l) => l.id === id),
    p = data.projects.find((p) => p.id === link?.project_id),
    m = data.milestones.find((m) => m.id === link?.milestone_id);
  if (!link || !p || !m || !memberRole(data, p.id, user?.id))
    return (
      <Empty>
        <h2>Delivery not available</h2>
        <p>
          Sign in with the account assigned to this project, or ask the client
          for a new link.
        </p>
        <Link href="/projects">Back to projects</Link>
      </Empty>
    );
  const a = data.agreements.find((a) => a.id === m.agreement_id),
    criteria = milestoneCriteria(data, m.id),
    history = revisions(data, m.id),
    last = history[0],
    role = memberRole(data, p.id, user?.id),
    current = activeLink(data, link),
    canSubmit =
      current &&
      role === "freelancer" &&
      link.freelancer_id === user?.id &&
      (!last || ["uploading", "changes"].includes(last.status)),
    review = data.reviews.find((r) => r.submission_id === last?.id);
  const name = (role: string) => {
    const member = data.members.find(
      (x) => x.project_id === p.id && x.role === role,
    );
    return (
      data.profiles.find((x) => x.id === member?.user_id)?.full_name ||
      "Project member"
    );
  };
  return (
    <>
      <Link className="backlink" href={"/projects/" + p.id + "/delivery"}>
        ← {p.title}
      </Link>
      <div className="delivery-heading">
        <div>
          <p className="eyebrow">WORK HANDOFF · V{a?.version}</p>
          <h1>{m.title}</h1>
          <p className="subtitle">
            {name("client")} → {name("freelancer")}
          </p>
        </div>
        <Badge status={last?.status}>{deliveryStatus(last)}</Badge>
      </div>
      <ol className="delivery-steps">
        <li className="done">
          <b>01</b>Agreement
        </li>
        <li className={last ? "done" : "current"}>
          <b>02</b>Evidence
        </li>
        <li className={last?.status === "approved" ? "done" : "current"}>
          <b>03</b>Client review
        </li>
        <li>
          <b>04</b>Payment <small>PayPal Sandbox</small>
        </li>
      </ol>
      <div className="handoff-grid">
        <section>
          <div className="delivery-panel">
            <div className="sectionhead">
              <h2>What to deliver</h2>
              <span className="subtle">{criteria.length} requirements</span>
            </div>
            <ul className="delivery-criteria">
              {criteria.map((c, i) => (
                <li key={c.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {c.description}
                </li>
              ))}
            </ul>
            {link.instructions && (
              <div className="delivery-instructions">
                <h3>Submission instructions</h3>
                <p>{link.instructions}</p>
              </div>
            )}
          </div>
          {!current && (
            <Notice>
              This link has expired, was revoked, or belongs to an older
              agreement. Saved evidence remains available. Ask the client for an
              updated link to submit work.
            </Notice>
          )}
          {review && (
            <div className={"review-note " + review.decision}>
              <strong>
                {review.decision === "approved"
                  ? "Work approved"
                  : "Please update your work"}
              </strong>
              <p>{review.note}</p>
              <small>Client decision · Revision {last.revision}</small>
            </div>
          )}
          {canSubmit && (
            <SubmitEvidence link={link} revision={last?.status === "changes"} />
          )}
          {history
            .filter((s) => s.status !== "uploading")
            .map((s) => (
              <EvidencePanel
                key={s.id}
                submission={s}
                criteria={criteria}
                canReview={
                  s.id === last?.id &&
                  s.status === "submitted" &&
                  role === "client" &&
                  reviewable(data, link)
                }
              />
            ))}
        </section>
        <aside>
          <div className="delivery-panel">
            <h2>Milestone details</h2>
            <dl className="delivery-details">
              <dt>Agreed amount</dt>
              <dd className="delivery-amount">{money(m.amount)}</dd>
              <dt>Due date</dt>
              <dd>{m.due_date}</dd>
              <dt>Verification</dt>
              <dd>Human review</dd>
              <dt>Payment</dt>
              <dd><Link href={"/payments#payment-" + m.id}>View Sandbox payment status</Link></dd>
            </dl>
          </div>
          {role === "client" && current && <ShareLink link={link} />}
          <p className="subtle">
            Each revision is kept with its evidence and review. Approval does
            not send money.
          </p>
        </aside>
      </div>
    </>
  );
}
function ShareLink({ link }: { link: SubmissionLink }) {
  const { refresh, notice } = useWorkspace(),
    task = useTask();
  const [revoke, setRevoke] = useState(false);
  const url =
    typeof window === "undefined"
      ? ""
      : window.location.origin + "/handoff/" + link.id;
  return (
    <>
      <div className="delivery-panel">
        <h3>Submission link</h3>
        <p className="subtle">For the assigned freelancer. Sign-in required.</p>
        <input
          className="field share-link"
          aria-label="Submission link"
          readOnly
          value={url}
        />
        <div className="actions sectionspace">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                notice("Link copied. Send it to your freelancer.");
              } catch {
                notice("Select and copy the link from the field.");
              }
            }}
          >
            Copy link
          </button>
          <button className="ghost" onClick={() => setRevoke(true)}>
            Revoke link
          </button>
        </div>
        <p className="subtle">
          Expires {new Date(link.expires_at).toLocaleDateString()}
        </p>
      </div>
      {revoke && (
        <Modal title="Revoke submission link?" onClose={() => setRevoke(false)}>
          <p className="dialogintro">
            This stops new submissions through this link. Saved evidence remains
            available for review.
          </p>
          <FormMessage error={task.error} />
          <div className="dialogfooter">
            <button onClick={() => setRevoke(false)}>Cancel</button>
            <button
              className="primary"
              disabled={task.busy}
              onClick={() =>
                void task.run(async () => {
                  await rpc(getSupabase(), "revoke_submission_link", {
                    p_link_id: link.id,
                  });
                  await refresh();
                  setRevoke(false);
                })
              }
            >
              Revoke link
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function SubmitEvidence({
  link,
  revision,
}: {
  link: SubmissionLink;
  revision: boolean;
}) {
  const { user, refresh, notice } = useWorkspace(),
    task = useTask();
  const [progress, setProgress] = useState("");
  const [finalizer] = useState(createEvidenceFinalizer);
  const [confirming, setConfirming] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      files = (f.getAll("files") as File[]).filter((f) => f.name),
      urls = String(f.get("urls") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      notes = String(f.get("notes") || "").trim(),
      owner = user?.id;
    void task.run(async () => {
      setProgress("");
      if (!finalizer.pending) {
        const issue = validateEvidence(files, urls);
        if (issue) throw Error(issue);
      }
      const client = getSupabase();
      const ensureIdentity = async () => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session?.user.id !== owner)
          throw Error("Account changed. Sign in again.");
      };
      await ensureIdentity();
      if (finalizer.pending) {
        setProgress("Confirming evidence submission...");
        await finalizer.submit(finalizer.pending, (snapshot) =>
          rpc(client, "submit_evidence", { ...snapshot }),
        );
        await refresh();
        notice("Evidence received. Awaiting client review.");
        return;
      }
      const id = await rpc(client, "begin_evidence_submission", {
        p_link_id: link.id,
      });
      const artifacts: Record<string, unknown>[] = [];
      for (const file of files) {
        await ensureIdentity();
        setProgress(
          "Uploading " + (artifacts.length + 1) + " of " + files.length + "…",
        );
        const path =
          id +
          "/" +
          crypto.randomUUID() +
          "-" +
          file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
        const { error } = await client.storage
          .from("proofpay-evidence")
          .upload(path, file, {
            contentType: "application/octet-stream",
            upsert: false,
          });
        if (error) throw error;
        artifacts.push({
          kind: "file",
          label: file.name.slice(0, 255),
          storage_path: path,
        });
      }
      for (const input of urls) {
        const url = safeUrl(input)!;
        artifacts.push({ kind: "url", label: new URL(url).hostname, url });
      }
      await ensureIdentity();
      setProgress("Saving evidence…");
      setConfirming(true);
      await finalizer.submit({
        p_submission_id: id,
        p_notes: notes,
        p_artifacts: artifacts,
      }, (snapshot) => rpc(client, "submit_evidence", { ...snapshot }));
      await refresh();
      notice("Evidence received. Awaiting client review.");
    });
  }
  return (
    <form className="delivery-panel" onSubmit={submit} aria-busy={task.busy}>
      <h2>{revision ? "Submit a revised delivery" : "Submit your work"}</h2>
      <label className="formlabel" htmlFor="files">
        Files
      </label>
      <input
        className="field file-field"
        id="files"
        name="files"
        type="file"
        multiple
        disabled={task.busy || confirming}
      />
      <p className="subtle">
        Up to 10 files and links combined · 20 MB per file
      </p>
      <label className="formlabel" htmlFor="urls">
        Work links
      </label>
      <textarea
        className="field"
        id="urls"
        name="urls"
        rows={2}
        placeholder={"https://your-project.com\nOne link per line"}
        disabled={task.busy || confirming}
      />
      <label className="formlabel" htmlFor="notes">
        Delivery notes
      </label>
      <textarea
        className="field"
        id="notes"
        name="notes"
        rows={3}
        maxLength={10000}
        placeholder="What is included? What changed?"
        disabled={task.busy || confirming}
      />
      <p className="subtle">
        We check that evidence was received. The client reviews whether it meets
        the requirements.
      </p>
      <FormMessage error={task.error} />
      {confirming && task.error && (
        <p className="fieldhelp">Submit again to confirm the same evidence. Files and notes are kept unchanged while confirmation is pending.</p>
      )}
      {task.busy && <p role="status">{progress || "Preparing submission…"}</p>}
      <button className="primary" disabled={task.busy}>
        {task.busy
          ? progress || "Preparing submission…"
          : "Submit for review →"}
      </button>
    </form>
  );
}
function EvidencePanel({
  submission: s,
  criteria,
  canReview,
}: {
  submission: Submission;
  criteria: Criterion[];
  canReview: boolean;
}) {
  const { data, notice } = useWorkspace();
  const artifacts = data.artifacts.filter((a) => a.submission_id === s.id),
    review = data.reviews.find((r) => r.submission_id === s.id);
  return (
    <article className="delivery-panel" id={"revision-" + s.revision}>
      <div className="sectionhead">
        <h2>Revision {s.revision}</h2>
        <Badge status={s.status}>{deliveryStatus(s)}</Badge>
      </div>
      <p className="subtle">
        Submitted {new Date(s.submitted_at || s.created_at).toLocaleString()} ·{" "}
        {artifacts.length} evidence items received
      </p>
      {s.notes && <p className="delivery-text">{s.notes}</p>}
      <div className="evidence-list">
        {artifacts.map((a) =>
          a.kind === "url" ? (
            <a
              key={a.id}
              href={safeUrl(a.url || "") || "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>↗</span>
              <div>
                {a.label}
                <small>{a.url}</small>
              </div>
            </a>
          ) : (
            <button
              key={a.id}
              onClick={async () => {
                if (!a.storage_path) return;
                try {
                  const { data, error } = await getSupabase()
                    .storage.from("proofpay-evidence")
                    .createSignedUrl(a.storage_path, 60, { download: a.label });
                  if (error) throw error;
                  const anchor = document.createElement("a");
                  anchor.href = data.signedUrl;
                  anchor.rel = "noopener";
                  anchor.click();
                } catch (e) {
                  notice(errorMessage(e));
                }
              }}
            >
              <span>↓</span>
              <div>
                {a.label}
                <small>
                  {Math.ceil((a.size_bytes || 0) / 1024)} KB · Download file
                </small>
              </div>
            </button>
          ),
        )}
      </div>
      {review && (
        <p className="delivery-text">
          <strong>Client feedback:</strong> {review.note}
        </p>
      )}
      <section
        className="verification-unavailable"
        aria-label="Verification status"
      >
        <strong>CANNOT_VERIFY · Automated checks not connected</strong>
        <p>
          No website or file-content checks have run for this revision. The
          client must inspect the submitted evidence against each requirement
          before making a decision.
        </p>
      </section>
      {canReview && <ReviewForm submission={s} criteria={criteria} />}
    </article>
  );
}
function ReviewForm({
  submission,
  criteria,
}: {
  submission: Submission;
  criteria: Criterion[];
}) {
  const { refresh, notice } = useWorkspace(),
    task = useTask();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      button = (e.nativeEvent as SubmitEvent)
        .submitter as HTMLButtonElement | null;
    const decision = button?.value;
    void task.run(async () => {
      const ids = f.getAll("criteria").map(String),
        note = String(f.get("note") || "").trim();
      if (!["approved", "changes"].includes(decision || ""))
        throw Error("Choose a decision.");
      if (!note) throw Error("Add decision notes.");
      if (
        decision === "approved" &&
        (!f.get("confirm") || ids.length !== criteria.length)
      )
        throw Error(
          "Verify every requirement and confirm your review before approving.",
        );
      await rpc(getSupabase(), "review_evidence", {
        p_submission_id: submission.id,
        p_decision: decision,
        p_note: note,
        p_confirmed_criteria: ids,
      });
      await refresh();
      notice(
        decision === "approved"
          ? "Milestone approved. No payment was made."
          : "Changes requested. The freelancer can submit a revision.",
      );
    });
  }
  return (
    <form onSubmit={submit}>
      <h3 className="sectionspace">Review requirements</h3>
      <p className="subtle">
        Inspect the evidence, then confirm each requirement you verified.
      </p>
      {criteria.map((c) => (
        <label key={c.id} className="review-check">
          <input type="checkbox" name="criteria" value={c.id} />
          <span>{c.description}</span>
        </label>
      ))}
      <label className="formlabel" htmlFor="decision-note">
        Decision notes
      </label>
      <textarea
        className="field"
        id="decision-note"
        name="note"
        required
        maxLength={5000}
        placeholder="Explain your approval or the specific changes needed."
      />
      <label className="review-check">
        <input type="checkbox" name="confirm" />
        <span>
          I reviewed the evidence. Approval records acceptance and does not make
          a payment.
        </span>
      </label>
      <FormMessage error={task.error} />
      <div className="actions">
        <button type="submit" value="changes" disabled={task.busy}>
          Request changes
        </button>
        <button
          type="submit"
          className="primary"
          value="approved"
          disabled={task.busy}
        >
          Approve milestone
        </button>
      </div>
    </form>
  );
}
