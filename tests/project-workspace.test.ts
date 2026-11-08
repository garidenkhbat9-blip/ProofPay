import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectWorkspace,
  workspaceHref,
  projectPhase,
} from "../src/lib/project-workspace";
import { emptyCloud, type Submission } from "../src/lib/types";

const now = Date.parse("2026-11-08T00:00:00Z");
function fixture() {
  const d = emptyCloud();
  d.projects.push({
    id: "p",
    created_by: "client",
    title: "Real project",
    description: "",
    work_category: "website",
    budget_amount: 100,
    currency: "USD",
    due_date: null,
    created_at: "2026-01-01",
    status: "active",
  });
  d.members.push(
    { project_id: "p", user_id: "client", role: "client" },
    { project_id: "p", user_id: "worker", role: "freelancer" },
  );
  d.agreements.push({
    id: "a",
    project_id: "p",
    version: 1,
    scope: "Scope",
    change_note: "",
    created_at: "2026-01-01",
  });
  d.milestones.push({
    id: "m",
    agreement_id: "a",
    position: 1,
    title: "Delivery",
    description: "",
    amount: 100,
    due_date: "2099-01-01",
  });
  d.approvals.push(
    {
      agreement_id: "a",
      user_id: "client",
      role: "client",
      approved_at: "2026-01-01",
    },
    {
      agreement_id: "a",
      user_id: "worker",
      role: "freelancer",
      approved_at: "2026-01-01",
    },
  );
  d.links.push({
    id: "l",
    project_id: "p",
    milestone_id: "m",
    freelancer_id: "worker",
    active: true,
    instructions: "",
    expires_at: "2099-01-01",
    created_at: "2026-01-01",
  });
  return d;
}
function submit(d: ReturnType<typeof fixture>, status: Submission["status"]) {
  d.submissions.push({
    id: "s",
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "worker",
    revision: 1,
    status,
    notes: "Evidence",
    created_at: "2026-01-01",
    submitted_at: "2026-01-01",
  });
}
const model = (d: ReturnType<typeof fixture>, user = "client") =>
  projectWorkspace(d, "p", user, now)!;
test("project presentation requires actual membership and never takes a perspective", () => {
  assert.equal(projectWorkspace(fixture(), "p", "other"), null);
  assert.equal(projectWorkspace(fixture(), "p"), null);
  assert.equal(model(fixture(), "worker").role, "freelancer");
});
test("client without freelancer sees Invite, pending invitation becomes waiting", () => {
  const d = fixture();
  d.members.pop();
  assert.equal(model(d).primary.invite, true);
  assert.equal(model(d).phases[0].state, "current");
  d.invitations.push({
    id: "i",
    project_id: "p",
    project_title: "Real project",
    invited_email: "worker@example.test",
    invited_by: "client",
    status: "pending",
    expires_at: "2099-01-01",
    created_at: "2026-01-01",
  });
  assert.equal(model(d).primary.invite, undefined);
  assert.equal(model(d).primary.title, "Waiting for freelancer");
  assert.equal(model(d).phases[0].state, "waiting");
});
test("latest agreement requires both parties; missing milestones cannot complete set up", () => {
  const d = fixture();
  d.approvals.pop();
  assert.equal(model(d).phases[0].state, "waiting");
  assert.equal(model(d, "worker").primary.title, "Review agreement");
  assert.equal(model(d, "worker").phases[1].state, "blocked");
  d.approvals.push({
    agreement_id: "a",
    user_id: "worker",
    role: "freelancer",
    approved_at: "2026-01-01",
  });
  assert.equal(model(d).phases[0].state, "complete");
  d.milestones = [];
  assert.notEqual(model(d).phases[0].state, "complete");
});
test("freelancer delivery is actionable; client waits for submission", () => {
  const d = fixture();
  assert.equal(model(d, "worker").primary.label, "Submit your work");
  assert.equal(
    model(d, "worker").primary.href,
    workspaceHref("p", "deliver", "l"),
  );
  assert.equal(model(d).primary.actor, "Freelancer");
  assert.equal(model(d).phases[1].state, "waiting");
  d.links[0].expires_at = new Date(now).toISOString();
  assert.equal(model(d, "worker").primary.title, "Waiting for client access");
  assert.equal(model(d).primary.label, "Create submission link");
});
test("submitted work offers human review only to the client", () => {
  const d = fixture();
  submit(d, "submitted");
  assert.equal(model(d).primary.label, "Review submission");
  assert.equal(model(d).phases[2].state, "current");
  assert.equal(model(d, "worker").phases[2].state, "waiting");
  assert.equal(model(d, "worker").primary.label, "View submitted work");
});
test("requested revisions reopen delivery and preserve prior evidence", () => {
  const d = fixture();
  submit(d, "changes");
  assert.equal(model(d, "worker").primary.label, "View feedback");
  assert.equal(model(d, "worker").phases[1].state, "current");
  d.submissions.push({
    ...d.submissions[0],
    id: "s2",
    revision: 2,
    status: "submitted",
  });
  assert.equal(model(d).rows[0].history.length, 2);
  assert.equal(model(d).primary.label, "Review submission");
});
test("approval alone completes human review but never payment", () => {
  const d = fixture();
  submit(d, "approved");
  assert.equal(model(d).phases[2].state, "complete");
  assert.equal(model(d).phases[3].state, "current");
  assert.equal(model(d).paid, 0);
});
test("payment completion requires exact matching verified records", () => {
  const d = fixture();
  submit(d, "approved");
  d.payments.push({
    id: "pay",
    project_id: "p",
    agreement_id: "a",
    milestone_id: "m",
    submission_id: "s",
    status: "PAID",
    last_verified_at: null,
    reconciliation_status: "SYNCED",
  });
  assert.notEqual(model(d).phases[3].state, "complete");
  d.payments[0].last_verified_at = "2026-11-08";
  assert.equal(model(d).phases[3].state, "complete");
  assert.equal(model(d).paid, 1);
  d.payments[0].submission_id = "old";
  assert.notEqual(model(d).phases[3].state, "complete");
});
test("mixed milestones keep incomplete work visible and do not complete the project", () => {
  const d = fixture();
  submit(d, "approved");
  d.milestones.push({ ...d.milestones[0], id: "m2", position: 2 });
  d.links.push({ ...d.links[0], id: "l2", milestone_id: "m2" });
  assert.equal(model(d).approved, 1);
  assert.notEqual(model(d).phases[2].state, "complete");
  assert.notEqual(model(d).phases[3].state, "complete");
  assert.equal(
    model(d, "worker").primary.href,
    workspaceHref("p", "deliver", "l2"),
  );
});
test("new agreement version resets current progress without removing history", () => {
  const d = fixture();
  submit(d, "approved");
  d.agreements.push({ ...d.agreements[0], id: "a2", version: 2 });
  d.milestones.push({ ...d.milestones[0], id: "m2", agreement_id: "a2" });
  assert.equal(model(d).ready, false);
  assert.equal(model(d).approved, 0);
  assert.equal(model(d).rows[0].milestone.id, "m2");
  assert.equal(d.submissions.length, 1);
});
test("archived or unavailable records cannot suggest new workflow actions", () => {
  const d = fixture();
  d.projects[0].status = "archived";
  assert.equal(model(d).primary.invite, undefined);
  assert(model(d).phases.every((p) => p.state === "blocked"));
  d.projects[0].status = "active";
  d.deliveryError = "Unavailable";
  assert.equal(model(d).primary.title, "Project status unavailable");
  assert(model(d).phases.every((p) => p.state === "blocked"));
});
test("zero-value approval needs no payment and URL selectors reject unknown phases", () => {
  const d = fixture();
  submit(d, "approved");
  d.milestones[0].amount = 0;
  assert.equal(model(d).phases[3].state, "complete");
  assert.equal(model(d).paid, 0);
  assert.equal(projectPhase("setup"), "setup");
  assert.equal(projectPhase("constructor"), null);
  assert.equal(
    workspaceHref("p", "review", "l&x=1"),
    "/projects/p?phase=review&handoff=l%26x%3D1",
  );
});
