"use client";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Icon, Modal } from "./ui";
import { money, safeUrl } from "@/lib/domain";
import {
  demoMilestones,
  demoStages,
  demoReducer,
  demoUnlockedStage,
  initialDemoWorkflow,
  type DemoEvidenceFile,
} from "@/lib/demo-workflow";

const sampleFiles: DemoEvidenceFile[] = [
  { name: "klipscale-source.zip", size: 2450000, sample: true },
  { name: "responsive-screenshots.pdf", size: 840000, sample: true },
];
const initialBrief =
  "Build a responsive marketing website for KlipScale, a short-form video platform. Include home, pricing and contact pages, accessible mobile navigation, and a clear launch handoff.";

function Status({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "review";
}) {
  return (
    <span className={`demo-status ${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function DemoWalkthrough({ onExplore }: { onExplore: () => void }) {
  const params = useSearchParams();
  const [role, setRole] = useState(
    params.get("role") === "freelancer" ? "freelancer" : "client",
  );
  const [state, dispatch] = useReducer(demoReducer, initialDemoWorkflow);
  const [name, setName] = useState("KlipScale marketing website");
  const [brief, setBrief] = useState(initialBrief);
  const [accepted, setAccepted] = useState(false);
  const [url, setUrl] = useState("https://klipscale.example/preview");
  const [notes, setNotes] = useState(
    "Home, pricing and contact pages are ready. Included source code and screenshots at 390px, 768px and 1440px. Please review the mobile layout against the agreed design.",
  );
  const [files, setFiles] = useState<DemoEvidenceFile[]>(sampleFiles);
  const [reviewed, setReviewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [restart, setRestart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const previousStage = useRef(state.stage);
  const latest = state.submissions.at(-1);
  const verified = !!latest && state.verifiedRevision === latest.revision;
  const revised = (latest?.revision || 0) > 1;
  const unlocked = demoUnlockedStage(state);
  const titles = [
    "Start with a clear brief",
    "Agree on what “done” means",
    "Deliver work with evidence",
    "Evidence, checked against the agreement",
    "The final decision stays with the client",
    state.paid
      ? "A complete handoff. A clear record."
      : "Approved work is ready for payment",
  ];
  const subtitles = [
    "Maya is hiring Alex to build a marketing website for KlipScale.",
    "A sample AI-assisted draft turns the brief into three measurable milestones.",
    "Alex is delivering milestone 01: Responsive website.",
    "Explore a scripted report with a pass, a warning and a check that needs human review.",
    "Review revision " +
      (latest?.revision || 1) +
      ", acknowledge the findings, then approve or request changes.",
    "Explore the payment handoff using a local PayPal simulation.",
  ];
  useEffect(() => {
    if (previousStage.current !== state.stage) {
      previousStage.current = state.stage;
      heading.current?.focus();
    }
  }, [state.stage]);
  useEffect(() => {
    if (menuOpen) menuClose.current?.focus();
  }, [menuOpen]);
  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }
  function navigate(stage: number) {
    setError("");
    setNotice("");
    setMenuOpen(false);
    dispatch({ type: "navigate", stage });
  }
  function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !brief.trim()) {
      setError("Add a project name and a short brief to continue.");
      return;
    }
    setError("");
    dispatch({ type: "create", name, brief });
  }
  function submitWork(event: FormEvent) {
    event.preventDefault();
    if (!safeUrl(url) || !notes.trim() || !files.length) {
      setError(
        "Add an HTTP or HTTPS project URL, delivery notes and at least one evidence file.",
      );
      return;
    }
    setError("");
    setReviewed(false);
    setAcknowledged(false);
    dispatch({ type: "submit", url, notes, files });
  }
  function requestChanges() {
    if (!reviewNote.trim()) {
      setError(
        "Describe what needs to change so Alex can prepare a new revision.",
      );
      return;
    }
    dispatch({ type: "changes", note: reviewNote });
    setNotes(
      "Revision update: optimized the hero image and reviewed the mobile layout. Updated source code and screenshots are included.",
    );
    setRole("freelancer");
    setReviewed(false);
    setAcknowledged(false);
    setError("");
  }
  function restartDemo() {
    dispatch({ type: "restart" });
    setName("KlipScale marketing website");
    setBrief(initialBrief);
    setAccepted(false);
    setUrl("https://klipscale.example/preview");
    setNotes(
      "Home, pricing and contact pages are ready. Included source code and screenshots at 390px, 768px and 1440px. Please review the mobile layout against the agreed design.",
    );
    setFiles(sampleFiles);
    setReviewed(false);
    setAcknowledged(false);
    setReviewNote("");
    setError("");
    setNotice("");
    setRestart(false);
  }
  function exportRecord() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            simulated: true,
            currency: "USD",
            milestones: demoMilestones,
            workflow: state,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "proofpay-simulated-project.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setNotice("Demo record downloaded. It contains simulated data only.");
  }
  const checks = [
    {
      name: "Pages & navigation",
      detail:
        "Sample result: home, pricing and contact pages respond; navigation works at three viewport sizes.",
      status: "Pass",
      tone: "success" as const,
    },
    {
      name: "Delivery package",
      detail: `${latest?.files.length || 0} evidence files listed in this revision. File contents are not read or verified.`,
      status: "Pass",
      tone: "success" as const,
    },
    {
      name: "Image performance",
      detail: revised
        ? "Sample revision result: hero image reduced to 180 KB."
        : "Sample result: hero image is 1.8 MB. Optimize it for slower mobile connections.",
      status: revised ? "Pass" : "Warning",
      tone: revised ? ("success" as const) : ("warning" as const),
    },
    {
      name: "Visual design match",
      detail:
        "Compare the submitted layout with the agreed design. Visual acceptance belongs to the client.",
      status: "Needs review",
      tone: "review" as const,
    },
  ];
  return (
    <div
      className="demo-tour"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) closeMenu();
      }}
    >
      <aside
        className={`sidebar demo-sidebar ${menuOpen ? "open" : ""}`}
        id="demo-sidebar"
        aria-label="Demo workspace navigation"
      >
        <button
          ref={menuClose}
          className="ghost demo-sidebar-close"
          aria-label="Close navigation"
          onClick={closeMenu}
        >
          <Icon name="close" />
        </button>
        <Brand />
        <div className="workspace">
          <span className="avatar">KS</span>
          <strong>KlipScale workspace</strong>
        </div>
        {demoStages.map((stage, index) => (
          <button
            key={stage.title}
            className={`nav ${state.stage === index ? "active" : ""}`}
            disabled={index > unlocked}
            aria-current={state.stage === index ? "step" : undefined}
            onClick={() => navigate(index)}
          >
            <Icon
              name={
                ["folder", "report", "link", "shield", "report", "wallet"][
                  index
                ]
              }
            />
            {stage.title}
          </button>
        ))}
        <div className="sidebottom">
          <div className="buildnote">
            <i className="dot" />
            Simulated workspace
          </div>
          <div className="user">
            <span className="avatar">{role === "client" ? "MC" : "AM"}</span>
            <div>
              <strong>{role === "client" ? "Maya Chen" : "Alex Morgan"}</strong>
              <small>
                {role === "client" ? "Client" : "Freelancer"} · Demo account
              </small>
            </div>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="demo-menu-backdrop"
          aria-label="Close demo navigation"
          onClick={closeMenu}
        />
      )}
      <div className="demo-main">
        <header className="demo-topbar">
          <div className="demo-header-crumb">
            <button
              ref={menuButton}
              className="ghost demo-menu-toggle"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="demo-sidebar"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
            <span>
              Demo workspace <span aria-hidden="true">/</span>{" "}
              <strong>{demoStages[state.stage].title}</strong>
            </span>
          </div>
          <Link className="buttonlike" href="/signup">
            Create an account <span aria-hidden="true">→</span>
          </Link>
        </header>
        <main className="demo-container">
          <div className="demo-simulation">
            <span className="demo-simulation-label">SIMULATION</span>
            <span>
              Sample AI results. Local files only. No real payments or database
              changes.
            </span>
          </div>
          <div className="demo-project-heading">
            <div>
              <p className="demo-kicker">WORKSPACE / GUIDED PROJECT</p>
              <h1>{state.project?.name || "KlipScale marketing website"}</h1>
              <p>
                Website development <span aria-hidden="true">·</span> $2,400 USD{" "}
                <span aria-hidden="true">·</span> 14 days
              </p>
            </div>
            <label className="demo-perspective">
              Your perspective
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="client">Maya · Client</option>
                <option value="freelancer">Alex · Freelancer</option>
              </select>
            </label>
          </div>
          <nav aria-label="Project workflow" className="demo-steps">
            <ol>
              {demoStages.map((stage, index) => (
                <li key={stage.title}>
                  <button
                    type="button"
                    disabled={index > unlocked}
                    aria-current={state.stage === index ? "step" : undefined}
                    onClick={() => navigate(index)}
                  >
                    <span
                      className={`demo-step-number ${index < unlocked || state.paid ? "complete" : ""}`}
                    >
                      {index < unlocked || state.paid
                        ? "✓"
                        : String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {stage.title}
                      <small>{stage.actor}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="demo-workspace-grid">
            <section className="demo-panel" aria-labelledby="demo-stage-title">
              <header className="demo-panel-heading">
                <div className="demo-stage-meta">
                  <span>
                    STEP {String(state.stage + 1).padStart(2, "0")} OF 06
                  </span>
                  <Status>{demoStages[state.stage].actor}</Status>
                </div>
                <h2 ref={heading} tabIndex={-1} id="demo-stage-title">
                  {titles[state.stage]}
                </h2>
                <p>{subtitles[state.stage]}</p>
              </header>
              <div className="demo-panel-body">
                <p className="demo-perspective-note">
                  {role === "client"
                    ? "Client view · Define the outcome, review the evidence, authorize payment."
                    : "Freelancer view · Agree on scope, deliver evidence, track approval."}{" "}
                  This guided demo lets you try both roles.
                </p>
                {state.stage === 0 && (
                  <form
                    id="demo-project-form"
                    onSubmit={createProject}
                    noValidate
                  >
                    <label className="formlabel" htmlFor="tour-project-name">
                      Project name
                    </label>
                    <input
                      className="field"
                      id="tour-project-name"
                      value={name}
                      maxLength={120}
                      readOnly={!!state.project}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <label className="formlabel" htmlFor="tour-project-brief">
                      Project brief
                    </label>
                    <textarea
                      className="field"
                      id="tour-project-brief"
                      value={brief}
                      maxLength={2000}
                      readOnly={!!state.project}
                      onChange={(e) => setBrief(e.target.value)}
                      required
                    />
                    <div className="demo-definition">
                      <div>
                        <span>Fixed project budget</span>
                        <strong>
                          $2,400 <small>USD</small>
                        </strong>
                      </div>
                      <div>
                        <span>Delivery window</span>
                        <strong>14 days</strong>
                      </div>
                      <div>
                        <span>Collaborators</span>
                        <strong>
                          Maya Chen <small>→ Alex Morgan</small>
                        </strong>
                      </div>
                    </div>
                    <p className="demo-caption">
                      Budget and dates are fixed for this guided example. Use
                      the freeform workspace to explore your own sample
                      projects.
                    </p>
                  </form>
                )}
                {state.stage === 1 && (
                  <>
                    <div className="demo-section-heading">
                      <h3>Milestone agreement</h3>
                      <Status tone={state.agreed ? "success" : "neutral"}>
                        {state.agreed
                          ? "v1 · Accepted"
                          : "v1 · Sample AI draft"}
                      </Status>
                    </div>
                    <div className="demo-table-scroll">
                      <table className="demo-table">
                        <caption className="demo-sr-only">
                          Milestones for the $2,400 sample agreement
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Milestone / deliverables</th>
                            <th scope="col">Due</th>
                            <th scope="col">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demoMilestones.map((milestone, i) => (
                            <tr key={milestone.title}>
                              <td>
                                <strong>
                                  <span className="demo-row-number">
                                    0{i + 1}
                                  </span>
                                  {milestone.title}
                                </strong>
                                <p>{milestone.deliverables}</p>
                              </td>
                              <td>{milestone.due}</td>
                              <td>{money(milestone.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th colSpan={2} scope="row">
                              Total · USD
                            </th>
                            <td>$2,400</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="demo-criteria">
                      <h3>Acceptance criteria</h3>
                      {demoMilestones.map((milestone, i) => (
                        <details
                          key={milestone.title}
                          open={i === 0 ? true : undefined}
                        >
                          <summary>
                            0{i + 1} · {milestone.title}
                          </summary>
                          <ul>
                            {milestone.criteria.map((criterion) => (
                              <li key={criterion}>{criterion}</li>
                            ))}
                          </ul>
                        </details>
                      ))}
                    </div>
                    <p className="demo-caption">
                      One revision round is included per milestone. Scope
                      changes require a new agreement version. This draft is
                      prepared sample content; no AI service is called.
                    </p>
                    <label className="demo-check">
                      <input
                        type="checkbox"
                        checked={accepted}
                        disabled={state.agreed}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      <span>
                        Simulate Maya and Alex accepting agreement v1 and its
                        acceptance criteria.
                      </span>
                    </label>
                  </>
                )}
                {state.stage === 2 && (
                  <>
                    <div className="demo-section-heading">
                      <h3>01 · Responsive website</h3>
                      <Status>
                        {state.decision === "changes"
                          ? `Revision ${(latest?.revision || 0) + 1} requested`
                          : "$1,200 milestone"}
                      </Status>
                    </div>
                    {state.decision === "changes" && (
                      <div className="demo-review-note">
                        <strong>Maya requested changes</strong>
                        <p>{state.reviewNote}</p>
                        <small>
                          The previous submission is kept in the project record.
                        </small>
                      </div>
                    )}
                    <form
                      id="demo-submission-form"
                      onSubmit={submitWork}
                      noValidate
                    >
                      <label className="formlabel" htmlFor="tour-work-url">
                        Project URL
                      </label>
                      <input
                        className="field"
                        id="tour-work-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        readOnly={!!latest && state.decision !== "changes"}
                        required
                      />
                      <p className="demo-caption">
                        Illustrative URL. The demo does not visit or scan
                        submitted websites.
                      </p>
                      <label className="formlabel" htmlFor="tour-work-notes">
                        Delivery notes
                      </label>
                      <textarea
                        className="field"
                        id="tour-work-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={2000}
                        readOnly={!!latest && state.decision !== "changes"}
                        required
                      />
                      <div className="demo-section-heading">
                        <h3>Evidence files</h3>
                        <span className="demo-caption">
                          Names only · never uploaded
                        </span>
                      </div>
                      <ul className="demo-file-list">
                        {files.map((file, index) => (
                          <li key={`${index}-${file.name}`}>
                            <Icon name="report" />
                            <div>
                              <strong>{file.name}</strong>
                              <small>
                                {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                                {file.sample
                                  ? "Sample placeholder"
                                  : "Local file · contents not read"}
                              </small>
                            </div>
                            {(!latest || state.decision === "changes") && (
                              <button
                                type="button"
                                className="ghost"
                                aria-label={`Remove ${file.name}`}
                                onClick={() =>
                                  setFiles(files.filter((_, i) => i !== index))
                                }
                              >
                                <Icon name="close" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {(!latest || state.decision === "changes") && (
                        <>
                          <label className="formlabel" htmlFor="tour-files">
                            Add local evidence
                          </label>
                          <input
                            className="field demo-file-input"
                            id="tour-files"
                            type="file"
                            multiple
                            onChange={(e) => {
                              const added = Array.from(
                                e.target.files || [],
                              ).map((file) => ({
                                name: file.name,
                                size: file.size,
                                sample: false,
                              }));
                              if (files.length + added.length > 8) {
                                setError(
                                  "Keep this sample delivery to 8 files or fewer.",
                                );
                              } else {
                                setFiles([...files, ...added]);
                                setError("");
                              }
                              e.target.value = "";
                            }}
                          />
                        </>
                      )}
                    </form>
                    {!!state.submissions.length && (
                      <details className="demo-history">
                        <summary>
                          Submission history · {state.submissions.length}{" "}
                          revision{state.submissions.length > 1 ? "s" : ""}
                        </summary>
                        {state.submissions.map((submission) => (
                          <div key={submission.revision}>
                            <strong>Revision {submission.revision}</strong>
                            <p>{submission.notes}</p>
                            <small>
                              {submission.files
                                .map((file) => file.name)
                                .join(" · ")}
                            </small>
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}
                {state.stage === 3 && (
                  <>
                    <div className="demo-section-heading">
                      <h3>Verification report</h3>
                      <Status tone={verified ? "success" : "neutral"}>
                        {verified
                          ? `Revision ${latest?.revision} · Ready`
                          : "Not run"}
                      </Status>
                    </div>
                    <div className="demo-report-context">
                      <Icon name="report" />
                      <div>
                        <strong>
                          Agreement v1 ↔ Submission v{latest?.revision}
                        </strong>
                        <p>{latest?.url}</p>
                      </div>
                    </div>
                    {!verified ? (
                      <div className="demo-verification-intro">
                        <h3>See how evidence becomes a review.</h3>
                        <p>
                          The sample report checks delivery against agreed
                          criteria and separates clear results from decisions
                          that need a person.
                        </p>
                        <button
                          className="primary"
                          onClick={() => {
                            dispatch({ type: "verify" });
                            setNotice(
                              "Sample report generated. No live verification was performed.",
                            );
                          }}
                        >
                          Generate sample report{" "}
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="demo-report-summary">
                          <span>{revised ? "3" : "2"} passed</span>
                          <span>{revised ? "0" : "1"} warning</span>
                          <span>1 needs review</span>
                        </div>
                        <div className="demo-check-results">
                          {checks.map((check) => (
                            <article key={check.name}>
                              <div>
                                <h4>{check.name}</h4>
                                <p>{check.detail}</p>
                              </div>
                              <Status tone={check.tone}>{check.status}</Status>
                            </article>
                          ))}
                        </div>
                        <p className="demo-caption">
                          These results are scripted examples, not observations
                          of your URL or files. Verification never approves work
                          or sends payment.
                        </p>
                      </>
                    )}
                  </>
                )}
                {state.stage === 4 && (
                  <>
                    <div className="demo-section-heading">
                      <h3>01 · Responsive website</h3>
                      <Status
                        tone={
                          state.decision === "approved" ? "success" : "review"
                        }
                      >
                        {state.decision === "approved"
                          ? "Approved"
                          : "Awaiting client decision"}
                      </Status>
                    </div>
                    <div className="demo-review-evidence">
                      <span className="demo-kicker">
                        SUBMISSION V{latest?.revision}
                      </span>
                      <strong>{latest?.url}</strong>
                      <p>{latest?.notes}</p>
                      <small>
                        {latest?.files.map((file) => file.name).join(" · ")}
                      </small>
                    </div>
                    <div className="demo-review-note">
                      <strong>
                        {revised
                          ? "One item needs your judgment"
                          : "Two findings to acknowledge"}
                      </strong>
                      <p>
                        {revised
                          ? "The sample image warning is resolved. Confirm the visual layout matches your expectations."
                          : "The hero image needs optimization. The visual design still needs a human review. You may request a revision or accept these findings."}
                      </p>
                    </div>
                    <label className="demo-check">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        disabled={state.decision === "approved"}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      <span>
                        I reviewed the sample delivery against all four
                        acceptance criteria.
                      </span>
                    </label>
                    <label className="demo-check">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        disabled={state.decision === "approved"}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                      />
                      <span>
                        I acknowledge the report findings and accept the visual
                        design for this simulation.
                      </span>
                    </label>
                    <label className="formlabel" htmlFor="tour-review-note">
                      Review note{" "}
                      <span className="demo-caption">
                        (required when requesting changes)
                      </span>
                    </label>
                    <textarea
                      className="field"
                      id="tour-review-note"
                      placeholder="For example: please optimize the hero image before approval."
                      value={reviewNote}
                      maxLength={2000}
                      disabled={state.decision === "approved"}
                      onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <p className="demo-caption">
                      Approval records acceptance of this milestone. Payment
                      remains a separate action.
                    </p>
                  </>
                )}
                {state.stage === 5 && (
                  <>
                    <div className="demo-section-heading">
                      <h3>Milestone payment</h3>
                      <Status tone="success">
                        {state.paid ? "Paid · simulation" : "Payment-ready"}
                      </Status>
                    </div>
                    <div className="demo-payment-amount">
                      <span>01 · Responsive website</span>
                      <strong>
                        $1,200<span>USD</span>
                      </strong>
                      <p>
                        {state.paid
                          ? "Simulated transfer to Alex Morgan"
                          : "Payable to Alex Morgan · Freelancer"}
                      </p>
                    </div>
                    <dl className="demo-payment-details">
                      <div>
                        <dt>Agreement</dt>
                        <dd>v1 · Accepted by both parties</dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd>Revision {latest?.revision} · Approved by Maya</dd>
                      </div>
                      <div>
                        <dt>Payment method</dt>
                        <dd>PayPal · Local simulation</dd>
                      </div>
                      {state.paid && (
                        <div>
                          <dt>Demo receipt</dt>
                          <dd>DEMO-KLIP-001 · Not a real transaction</dd>
                        </div>
                      )}
                      <div>
                        <dt>Remaining project value</dt>
                        <dd>$1,200 · Milestones 02–03</dd>
                      </div>
                    </dl>
                    <p className="demo-caption">
                      No PayPal account, credentials or network request is used.
                      No fees are calculated and no money moves.
                    </p>
                    {state.paid && (
                      <div className="demo-completion">
                        <h3>You’ve seen the full workflow.</h3>
                        <p>
                          Clear scope, evidence-led review, a client decision,
                          and a separate payment record.
                        </p>
                        <div className="demo-inline-actions">
                          <button onClick={exportRecord}>
                            Download demo record
                          </button>
                          <Link className="buttonlike forest" href="/signup">
                            Create your account →
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <p className="demo-inline-error" role="alert">
                  {error}
                </p>
                <p className="demo-inline-notice" role="status">
                  {notice}
                </p>
              </div>
              <footer className="demo-panel-footer">
                <button
                  disabled={state.stage === 0}
                  onClick={() => navigate(state.stage - 1)}
                >
                  ← Back
                </button>
                <div className="demo-inline-actions">
                  {state.stage === 0 &&
                    (state.project ? (
                      <button className="primary" onClick={() => navigate(1)}>
                        Next: agreement →
                      </button>
                    ) : (
                      <button
                        className="primary"
                        type="submit"
                        form="demo-project-form"
                      >
                        Create sample project →
                      </button>
                    ))}
                  {state.stage === 1 && (
                    <button
                      className="primary"
                      disabled={!accepted && !state.agreed}
                      onClick={() => {
                        if (state.agreed) navigate(2);
                        else dispatch({ type: "agree" });
                        setRole("freelancer");
                      }}
                    >
                      {" "}
                      {state.agreed
                        ? "Next: submission"
                        : "Accept sample agreement"}{" "}
                      →
                    </button>
                  )}
                  {state.stage === 2 &&
                    (latest && state.decision !== "changes" ? (
                      <button className="primary" onClick={() => navigate(3)}>
                        Next: verification →
                      </button>
                    ) : (
                      <button
                        className="primary"
                        type="submit"
                        form="demo-submission-form"
                      >
                        {latest ? "Submit revised work" : "Submit sample work"}{" "}
                        →
                      </button>
                    ))}
                  {state.stage === 3 && (
                    <button
                      className="primary"
                      disabled={!verified}
                      onClick={() => {
                        navigate(4);
                        setRole("client");
                      }}
                    >
                      Next: client review →
                    </button>
                  )}
                  {state.stage === 4 &&
                    (state.decision === "approved" ? (
                      <button className="primary" onClick={() => navigate(5)}>
                        Next: payment →
                      </button>
                    ) : (
                      <>
                        <button onClick={requestChanges}>
                          Request changes
                        </button>
                        <button
                          className="primary"
                          disabled={!reviewed || !acknowledged}
                          onClick={() => {
                            setError("");
                            dispatch({
                              type: "approve",
                              reviewed,
                              acknowledged,
                              note: reviewNote,
                            });
                          }}
                        >
                          Approve milestone →
                        </button>
                      </>
                    ))}
                  {state.stage === 5 &&
                    (!state.paid ? (
                      <button
                        className="primary"
                        onClick={() => setCheckout(true)}
                      >
                        Simulate PayPal payment →
                      </button>
                    ) : (
                      <button onClick={() => setRestart(true)}>
                        Restart walkthrough
                      </button>
                    ))}
                </div>
              </footer>
            </section>
            <aside className="demo-context" aria-label="Project context">
              <section>
                <h2>Project overview</h2>
                <dl>
                  <div>
                    <dt>Client</dt>
                    <dd>
                      <span className="demo-avatar">MC</span>Maya Chen
                    </dd>
                  </div>
                  <div>
                    <dt>Freelancer</dt>
                    <dd>
                      <span className="demo-avatar freelancer">AM</span>Alex
                      Morgan
                    </dd>
                  </div>
                  <div>
                    <dt>Project value</dt>
                    <dd>$2,400 USD</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <Status
                        tone={
                          state.paid || state.decision === "approved"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {state.paid
                          ? "Milestone 01 paid"
                          : state.decision === "approved"
                            ? "Payment-ready"
                            : state.decision === "changes"
                              ? "Changes requested"
                              : verified
                                ? "Client review"
                                : latest
                                  ? "Work submitted"
                                  : state.agreed
                                    ? "In progress"
                                    : state.project
                                      ? "Agreement draft"
                                      : "Project draft"}
                      </Status>
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>Milestones</h2>
                <ol className="demo-milestone-list">
                  {demoMilestones.map((milestone, index) => (
                    <li key={milestone.title}>
                      <span>0{index + 1}</span>
                      <div>
                        <strong>{milestone.title}</strong>
                        <small>
                          {index === 0
                            ? state.paid
                              ? "Paid · simulated"
                              : state.decision === "approved"
                                ? "Approved"
                                : state.agreed
                                  ? "Current milestone"
                                  : "Planned"
                            : "Upcoming"}
                        </small>
                      </div>
                      <b>{money(milestone.amount)}</b>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2>
                  Activity <span className="demo-caption">This session</span>
                </h2>
                {!state.activity.length ? (
                  <p className="demo-caption">
                    Create the sample project to start its activity record.
                  </p>
                ) : (
                  <ol className="demo-timeline">
                    {state.activity.slice(-6).map((event, i) => (
                      <li key={`${event.title}-${i}`}>
                        <strong>{event.title}</strong>
                        <span>{event.actor}</span>
                        <p>{event.detail}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </aside>
          </div>
          <footer className="demo-page-footer">
            <button className="ghost" onClick={onExplore}>
              Open freeform workspace ↗
            </button>
            <span>
              Explore sample projects with the original local demo tools.
            </span>
            <button className="ghost" onClick={() => setRestart(true)}>
              Restart demo
            </button>
          </footer>
        </main>
      </div>
      {checkout && (
        <Modal
          title="PayPal payment · simulation"
          onClose={() => setCheckout(false)}
        >
          <div className="demo-checkout">
            <Status>LOCAL DEMO · NO MONEY MOVES</Status>
            <p>Review a simulated payment for the approved milestone.</p>
            <dl className="demo-payment-details">
              <div>
                <dt>From</dt>
                <dd>Maya Chen</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>Alex Morgan</dd>
              </div>
              <div>
                <dt>Milestone</dt>
                <dd>Responsive website</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>$1,200 USD</dd>
              </div>
            </dl>
            <p>
              No PayPal connection or login is needed. Completing this step only
              updates the local demo.
            </p>
            <div className="demo-inline-actions">
              <button onClick={() => setCheckout(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  dispatch({ type: "pay" });
                  setCheckout(false);
                  setNotice("Simulated payment complete. No money moved.");
                }}
              >
                Complete simulated payment
              </button>
            </div>
          </div>
        </Modal>
      )}
      {restart && (
        <Modal
          title="Restart this walkthrough?"
          onClose={() => setRestart(false)}
        >
          <p>
            This clears the guided demo in this tab. Your freeform demo projects
            are kept.
          </p>
          <div className="demo-inline-actions">
            <button onClick={() => setRestart(false)}>Keep exploring</button>
            <button className="primary" onClick={restartDemo}>
              Restart demo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
