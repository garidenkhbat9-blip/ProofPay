"use client";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heading, Modal, Badge, Notice } from "./ui";
import { money, safeUrl } from "@/lib/domain";
import { DemoWalkthrough } from "./demo-walkthrough";
interface DemoProject {
  id: string;
  name: string;
  description: string;
  budget: number;
  criteria: string[];
  status: string;
  sample?: boolean;
  agreement?: boolean;
  submission?: { url: string; notes: string };
  review?: { decision: string; note: string };
}
const samples: DemoProject[] = [
  {
    id: "sample-website",
    name: "KlipScale website",
    description: "Build a responsive website for a short-form video platform.",
    budget: 2400,
    criteria: [
      "Landing page works on desktop and mobile",
      "Mobile navigation opens and closes",
      "Source files delivered",
    ],
    status: "review",
    agreement: true,
    sample: true,
    submission: {
      url: "https://example.com",
      notes: "Illustrative submission for exploring the workflow.",
    },
  },
  {
    id: "sample-brand",
    name: "Brand identity system",
    description: "Create a logo, color palette and typography guide.",
    budget: 1200,
    criteria: ["Primary logo as SVG and PNG", "Brand guidelines included"],
    status: "progress",
    agreement: true,
    sample: true,
  },
];
export function DemoPage() {
  const [freeform, setFreeform] = useState(false);
  return (
    <>
      <div hidden={freeform}>
        <DemoWalkthrough onExplore={() => setFreeform(true)} />
      </div>
      {freeform && (
        <>
          <div className="demo-return">
            <button onClick={() => setFreeform(false)}>
              ← Back to guided walkthrough
            </button>
            <span>Local demo · Your sample projects stay in this browser.</span>
          </div>
          <FreeformDemo />
        </>
      )}
    </>
  );
}
function FreeformDemo() {
  const params = useSearchParams(),
    [role, setRole] = useState(
      params.get("role") === "freelancer" ? "freelancer" : "client",
    ),
    [projects, setProjects] = useState<DemoProject[]>(samples),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("proofpay-next-demo");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setProjects(parsed);
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("proofpay-next-demo", JSON.stringify(projects));
      } catch {
        setMessage(
          "Browser storage is unavailable. Changes remain in this tab.",
        );
      }
  }, [projects, ready]);
  const p = projects.find((p) => p.id === selected);
  const update = (patch: Partial<DemoProject>) =>
    setProjects((projects) =>
      projects.map((x) => (x.id === selected ? { ...x, ...patch } : x)),
    );
  function exportDemo() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ projects }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "proofpay-demo.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="demo-shell">
      <header className="topbar">
        <Brand />
        <div className="actions">
          <label>
            <select
              className="field"
              aria-label="Preview role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="client">Client preview</option>
              <option value="freelancer">Freelancer preview</option>
            </select>
          </label>
          <Link className="buttonlike forest" href="/signup">
            Create real account →
          </Link>
        </div>
      </header>
      <main className="content">
        <Notice>
          Local demo · Sample data · No real invitations, verification or
          payments.
        </Notice>
        <Heading
          title={
            role === "client" ? "Client workspace" : "Freelancer workspace"
          }
          subtitle="Explore both perspectives with sample projects."
        >
          {role === "client" && (
            <button onClick={() => setCreating(true)}>
              + New sample project
            </button>
          )}
        </Heading>
        <section className="overview">
          <div className="stat">
            <div className="statlabel">Sample projects</div>
            <div className="statvalue">{projects.length}</div>
          </div>
          <div className="stat">
            <div className="statlabel">Planned sample budget</div>
            <div className="statvalue">
              {money(projects.reduce((n, p) => n + p.budget, 0))}
            </div>
          </div>
        </section>
        <div className="delivery-list">
          {projects.map((p) => (
            <button
              className="delivery-row demo-project"
              key={p.id}
              onClick={() => setSelected(p.id)}
            >
              <div>
                <h3>{p.name}</h3>
                <p>
                  {p.sample ? "Sample project" : "Local project"} ·{" "}
                  {money(p.budget)}
                </p>
              </div>
              <Badge status={p.status === "review" ? "submitted" : p.status}>
                {p.status === "review" ? "Needs review" : p.status}
              </Badge>
              <span>Open →</span>
            </button>
          ))}
          {!projects.length && (
            <div className="empty">
              No local projects. Create one or restore the samples.
            </div>
          )}
        </div>
        <div className="actions sectionspace">
          <button onClick={exportDemo}>Export demo data</button>
          <button
            onClick={() => setProjects(projects.filter((p) => !p.sample))}
          >
            Remove sample projects
          </button>
          <button
            onClick={() =>
              setProjects([...projects.filter((p) => !p.sample), ...samples])
            }
          >
            Restore samples
          </button>
        </div>
        <p role="status">{message}</p>
      </main>
      {creating && (
        <Modal title="New sample project" onClose={() => setCreating(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setProjects([
                ...projects,
                {
                  id: crypto.randomUUID(),
                  name: String(f.get("name")).trim(),
                  description: String(f.get("description")),
                  budget: Number(f.get("budget")),
                  criteria: [],
                  status: "draft",
                },
              ]);
              setCreating(false);
            }}
          >
            <label className="formlabel" htmlFor="sample-name">
              Name
            </label>
            <input
              className="field"
              id="sample-name"
              name="name"
              required
              maxLength={120}
            />
            <label className="formlabel" htmlFor="sample-description">
              Brief
            </label>
            <textarea
              className="field"
              id="sample-description"
              name="description"
              required
            />
            <label className="formlabel" htmlFor="sample-budget">
              Budget (USD)
            </label>
            <input
              className="field"
              id="sample-budget"
              name="budget"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
            <div className="dialogfooter">
              <button className="primary">Save locally</button>
            </div>
          </form>
        </Modal>
      )}
      {p && (
        <Modal title={p.name} onClose={() => setSelected(null)}>
          <p>{p.description}</p>
          {role === "client" ? (
            <form
              key={p.id + "agreement"}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                update({
                  criteria: String(f.get("criteria"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  agreement: true,
                  status: p.submission ? "review" : "progress",
                  review: undefined,
                });
                setMessage("Sample agreement saved locally.");
              }}
            >
              <label className="formlabel" htmlFor="demo-criteria">
                Acceptance criteria · one per line
              </label>
              <textarea
                className="field"
                id="demo-criteria"
                name="criteria"
                required
                defaultValue={p.criteria.join("\n")}
              />
              <button className="sectionspace">Save sample agreement</button>
            </form>
          ) : (
            <>
              <h3>Requirements</h3>
              <ol>
                {p.criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            </>
          )}
          {p.review && (
            <div className="review-note">
              <strong>
                {p.review.decision === "approved"
                  ? "Approved · demo only"
                  : "Changes requested"}
              </strong>
              <p>{p.review.note}</p>
            </div>
          )}
          {role === "freelancer" && p.agreement && p.status !== "approved" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  url = safeUrl(String(f.get("url")));
                if (!url) {
                  setMessage("Enter an HTTP or HTTPS URL.");
                  return;
                }
                update({
                  submission: { url, notes: String(f.get("notes")) },
                  status: "review",
                  review: undefined,
                });
                setMessage("Sample submission saved locally.");
              }}
            >
              <label className="formlabel" htmlFor="demo-url">
                Work URL
              </label>
              <input
                className="field"
                id="demo-url"
                name="url"
                type="url"
                required
                defaultValue={p.submission?.url}
              />
              <label className="formlabel" htmlFor="demo-notes">
                Notes
              </label>
              <textarea className="field" id="demo-notes" name="notes" />
              <button className="primary sectionspace">
                Submit sample work
              </button>
            </form>
          )}
          {p.submission && (
            <section className="sectionspace">
              <h3>Submitted evidence</h3>
              <a
                href={safeUrl(p.submission.url) || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.submission.url} ↗
              </a>
              <p>{p.submission.notes}</p>
              <p className="subtle">
                Automated verification: CANNOT_VERIFY · not connected.
              </p>
            </section>
          )}
          {role === "client" && p.submission && p.status === "review" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  decision = (
                    (e.nativeEvent as SubmitEvent)
                      .submitter as HTMLButtonElement
                  )?.value;
                if (!["approved", "changes"].includes(decision)) return;
                update({
                  status: decision,
                  review: { decision, note: String(f.get("note")) },
                });
                setMessage("Sample decision recorded. No payment was made.");
              }}
            >
              <label className="formlabel" htmlFor="demo-note">
                Review notes
              </label>
              <textarea className="field" id="demo-note" name="note" required />
              <label className="review-check">
                <input type="checkbox" required />I reviewed this sample
                evidence.
              </label>
              <div className="actions">
                <button value="changes">Request changes</button>
                <button className="primary" value="approved">
                  Approve sample
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
