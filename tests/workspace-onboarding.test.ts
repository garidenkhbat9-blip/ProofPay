import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyCloud, type Submission } from "../src/lib/types";
import { workspaceIdentity, dashboardGuidance } from "../src/lib/workspace-onboarding";
import { WorkspaceOnboarding } from "../src/components/workspace-onboarding";
import { accountPerspective, perspectiveKey, recordPerspective } from "../src/lib/workspace-sync";
import { judgeRole } from "../src/lib/judge-access";
import { memberRole } from "../src/lib/domain";

const client = { id: "client", email: "personal.prefix@example.test", user_metadata: {} };
const worker = { id: "worker", email: "worker@example.test", user_metadata: { preferred_workspace: "freelancer" } };
function fixture() {
  const data = emptyCloud();
  data.projects.push({ id: "p", title: "Actual project", description: "", work_category: "website", budget_amount: 100, due_date: null, status: "active", currency: "USD", created_at: "2026-01-01" });
  data.members.push({ project_id: "p", user_id: "client", role: "client" }, { project_id: "p", user_id: "worker", role: "freelancer" });
  data.agreements.push({ id: "a", project_id: "p", version: 1, scope: "Work", change_note: "", created_at: "2026-01-01" });
  data.milestones.push({ id: "m", agreement_id: "a", position: 1, title: "Delivery", description: "", amount: 100, due_date: "2099-01-01" });
  return data;
}
function accept(data: ReturnType<typeof fixture>) {
  data.approvals.push({ agreement_id: "a", user_id: "client", role: "client", approved_at: "2026-01-01" }, { agreement_id: "a", user_id: "worker", role: "freelancer", approved_at: "2026-01-01" });
  data.links.push({ id: "l", project_id: "p", milestone_id: "m", freelancer_id: "worker", active: true, instructions: "", expires_at: "2099-01-01", created_at: "2026-01-01" });
}
function submit(data: ReturnType<typeof fixture>, status: Submission["status"]) {
  data.submissions.push({ id: "s", project_id: "p", milestone_id: "m", link_id: "l", submitted_by: "worker", revision: 1, status, notes: "", created_at: "2026-01-01", submitted_at: "2026-01-01" });
}

test("new and returning accounts get a neutral greeting without a reliable first-visit marker", () => {
  const newUser = { ...client, created_at: "2026-10-30", last_sign_in_at: "2026-10-30" };
  const returningUser = { ...client, created_at: "2020-01-01", last_sign_in_at: "2026-10-30" };
  for (const user of [newUser, returningUser]) {
    assert.equal(workspaceIdentity(user, []).greeting, "Welcome to ProofPay");
    assert.equal(dashboardGuidance(emptyCloud(), user, "client").projects.length, 0);
  }
  assert.equal(workspaceIdentity(returningUser, fixture().profiles).greeting, workspaceIdentity(newUser, []).greeting);
});

test("names use the current stored profile or metadata, never an email prefix", () => {
  assert.deepEqual(workspaceIdentity(client, []), { displayName: "Your account", initials: "PP", greeting: "Welcome to ProofPay" });
  assert.equal(workspaceIdentity(client, [{ id: "other", full_name: "Someone Else" }]).displayName, "Your account");
  const user = { ...client, user_metadata: { full_name: "  Ada   Lovelace  " } };
  assert.equal(workspaceIdentity(user, []).displayName, "Ada Lovelace");
  assert.equal(workspaceIdentity(user, []).initials, "AL");
  assert.equal(workspaceIdentity(user, [{ id: client.id, full_name: "Updated Name" }]).displayName, "Updated Name");
  for (const full_name of [" ", null, 42, { name: "Invalid" }]) assert.equal(workspaceIdentity({ ...client, user_metadata: { full_name } }, []).displayName, "Your account");
});

test("initial perspective honors valid entry intent, per-account choice, then signup preference", () => {
  assert.equal(accountPerspective(null, "client"), "client");
  assert.equal(accountPerspective(null, "freelancer"), "freelancer");
  assert.equal(accountPerspective("client", "freelancer", judgeRole("freelancer")), "freelancer");
  assert.equal(accountPerspective("freelancer", "client", judgeRole("client")), "client");
  assert.equal(accountPerspective("freelancer", "client", judgeRole("admin")), "freelancer");
  assert.equal(accountPerspective("invalid", "invalid"), "client");
  assert.notEqual(perspectiveKey(client.id), perspectiveKey(worker.id));
});

test("switching perspective only filters actual membership and never grants project actions", () => {
  const data = fixture();
  const snapshot = JSON.stringify(data);
  assert.equal(dashboardGuidance(data, client, "client").projects.length, 1);
  assert.equal(dashboardGuidance(data, client, "freelancer").actions.length, 0);
  for (const view of ["client", "freelancer"] as const) assert.equal(dashboardGuidance(data, { ...client, id: "outsider" }, view).projects.length, 0);
  assert.equal(memberRole(data, "p", client.id), "client");
  assert.equal(JSON.stringify(data), snapshot);
});

test("record fallback uses this account's sole membership or own profile without assigning roles", () => {
  const data = fixture();
  data.profiles.push({ id: worker.id, full_name: "", preferred_workspace: "client" });
  const before = JSON.stringify(data);
  assert.equal(recordPerspective(data, worker.id), "freelancer");
  assert.equal(recordPerspective(data, client.id), "client");
  assert.equal(recordPerspective(data, "outsider"), "client");
  assert.equal(JSON.stringify(data), before);
  const empty = emptyCloud();
  empty.profiles.push({ id: worker.id, full_name: "", preferred_workspace: "freelancer" });
  assert.equal(recordPerspective(empty, worker.id), "freelancer");
  assert.equal(recordPerspective(empty, client.id), "client");
});

test("mixed project roles remain available without granting access in the other view", () => {
  const data = fixture();
  data.projects.push({ ...data.projects[0], id: "another" });
  data.members.push({ project_id: "another", user_id: client.id, role: "freelancer" });
  assert.deepEqual(dashboardGuidance(data, client, "client").projects.map((p) => p.id), ["p"]);
  assert.deepEqual(dashboardGuidance(data, client, "freelancer").projects.map((p) => p.id), ["another"]);
  assert.deepEqual(dashboardGuidance(data, worker, "client").otherProjects.map((p) => p.id), ["p"]);
  assert.deepEqual(dashboardGuidance(data, { ...worker, id: "outsider" }, "client").otherProjects, []);
});

test("real empty states render role-appropriate CTAs and four uncompleted workflow steps", () => {
  const clientHtml = renderToStaticMarkup(createElement(WorkspaceOnboarding, { perspective: "client", pendingInvitation: false }));
  const workerHtml = renderToStaticMarkup(createElement(WorkspaceOnboarding, { perspective: "freelancer", pendingInvitation: false }));
  assert.match(clientHtml, /href="\/projects\/new"/);
  assert.match(clientHtml, /Create a project/);
  assert.match(clientHtml, /<h1[^>]*>Welcome to ProofPay\.<\/h1>/);
  assert.match(clientHtml, /Create your first project/);
  assert.match(clientHtml, /Start with a project, invite your freelancer, and agree on what success looks like\./);
  assert.match(workerHtml, /Your workspace is ready/);
  assert.match(workerHtml, /href="\/invitations"/);
  assert.match(workerHtml, /Check invitations/);
  assert.match(workerHtml, /review the agreement, deliver work, and track approvals/);
  assert.doesNotMatch(workerHtml, /\/projects\/new|Create a project/);
  for (const html of [clientHtml, workerHtml]) {
    assert.equal((html.match(/<li /g) || []).length, 4);
    assert.match(html, /not completed progress/);
    assert.doesNotMatch(html, /aria-current="step"|class="complete"/);
  }
});

test("only an incoming pending invitation takes priority, and expired/failed reads do not imply one", () => {
  const data = emptyCloud();
  data.invitations.push({ id: "invite", project_id: "p", project_title: "Work", invited_email: worker.email, invited_by: client.id, status: "pending", expires_at: "2099-01-01", created_at: "2026-01-01" });
  assert.equal(dashboardGuidance(data, worker, "freelancer").pendingInvitation, true);
  assert.equal(dashboardGuidance(data, client, "client").pendingInvitation, false);
  const html = renderToStaticMarkup(createElement(WorkspaceOnboarding, { perspective: "client", pendingInvitation: true }));
  assert.match(html, /class="buttonlike forest" href="\/invitations"/);
  data.invitationError = "Unavailable";
  assert.equal(dashboardGuidance(data, worker, "freelancer").pendingInvitation, false);
  data.invitationError = ""; data.invitations[0].expires_at = "2020-01-01";
  assert.equal(dashboardGuidance(data, worker, "freelancer").pendingInvitation, false);
});

test("contextual actions follow agreement, actual evidence, human review and separate payment history", () => {
  const data = fixture();
  const step = (user = client) => dashboardGuidance(data, user, user.id === client.id ? "client" : "freelancer").actions[0].step;
  assert.equal(step().href, "/projects/p/agreement");
  accept(data);
  assert.equal(step(worker).label, "Submit work");
  assert.equal(step(worker).href, "/handoff/l");
  submit(data, "submitted");
  assert.equal(step().label, "Review & approve");
  assert.equal(step(worker).attention, false);
  data.submissions[0].status = "approved";
  assert.equal(step().href, "/payments");
  assert.match(step().status, /check payment status/);
  assert.doesNotMatch(step().status, /Paid/);
  data.deliveryError = "Unavailable";
  assert.equal(step().status, "Status unavailable");
});

test("actionable projects come first; archived projects and unrelated roles do not become next actions", () => {
  const data = fixture();
  accept(data); submit(data, "submitted");
  data.projects.unshift({ ...data.projects[0], id: "p2" });
  data.members.push({ project_id: "p2", user_id: client.id, role: "client" }, { project_id: "p2", user_id: worker.id, role: "freelancer" });
  data.agreements.push({ ...data.agreements[0], id: "a2", project_id: "p2" });
  data.approvals.push({ agreement_id: "a2", user_id: client.id, role: "client", approved_at: "2026-01-01" });
  assert.equal(dashboardGuidance(data, client, "client").actions[0].project.id, "p");
  data.projects.find((p) => p.id === "p")!.status = "archived";
  assert.equal(dashboardGuidance(data, client, "client").actions.length, 1);
  assert.equal(dashboardGuidance(data, client, "client").actions[0].project.id, "p2");
});
