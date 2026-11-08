import { test } from "node:test";
import assert from "node:assert/strict";
import { clientOverview, overviewStatus } from "../src/lib/client-overview";
import { emptyCloud, type Submission } from "../src/lib/types";

function fixture() {
  const d = emptyCloud();
  d.projects.push({ id: "p", created_by: "client", title: "Real project", description: "", work_category: "website", budget_amount: 100, currency: "USD", due_date: null, created_at: "2026-01-01", status: "active" });
  d.members.push({ project_id: "p", user_id: "client", role: "client" }, { project_id: "p", user_id: "worker", role: "freelancer" });
  d.agreements.push({ id: "a", project_id: "p", version: 1, scope: "Scope", change_note: "", created_at: "2026-01-01" });
  d.milestones.push({ id: "m", agreement_id: "a", position: 1, title: "Delivery", description: "", amount: 100, due_date: "2099-01-01" });
  d.approvals.push({ agreement_id: "a", user_id: "client", role: "client", approved_at: "2026-01-01" }, { agreement_id: "a", user_id: "worker", role: "freelancer", approved_at: "2026-01-01" });
  d.links.push({ id: "l", project_id: "p", milestone_id: "m", freelancer_id: "worker", active: true, instructions: "", expires_at: "2099-01-01", created_at: "2026-01-01" });
  return d;
}
function submit(d: ReturnType<typeof fixture>, status: Submission["status"], notes = "Evidence notes") {
  d.submissions.push({ id: "s", project_id: "p", milestone_id: "m", link_id: "l", submitted_by: "worker", revision: 1, status, notes, created_at: "2026-01-01", submitted_at: "2026-01-01" });
}
test("client overview scopes to real client membership and handles empty accounts", () => {
  for (const id of [undefined, "outsider", "worker"]) assert.equal(clientOverview(fixture(), id).rows.length, 0);
  assert.deepEqual(clientOverview(emptyCloud(), "client").metrics, { active: 0, review: 0, response: 0, payment: 0 });
});
test("archived projects retain rows but never enter active metrics or primary action", () => {
  const d = fixture(); submit(d, "submitted"); d.projects[0].status = "archived";
  const model = clientOverview(d, "client");
  assert.equal(model.rows.length, 1); assert.equal(model.next, undefined); assert.equal(model.aiReview, undefined);
  assert.deepEqual(model.metrics, { active: 0, review: 0, response: 0, payment: 0 });
});
test("response counts the freelancer turn, not every unfinished project", () => {
  const d = fixture(); assert.equal(clientOverview(d, "client").metrics.response, 1);
  d.links = []; assert.equal(clientOverview(d, "client").metrics.response, 0);
  assert.equal(clientOverview(d, "client").next?.step?.label, "Create submission link");
});
test("current submitted work exposes existing review and text assistant, without analysis", () => {
  const d = fixture(); submit(d, "submitted"); const model = clientOverview(d, "client");
  assert.equal(model.metrics.review, 1); assert.equal(model.aiReview?.step?.href, "/handoff/l");
  assert.equal(overviewStatus(model.next!.step), "Awaiting review");
  d.submissions[0].notes = ""; assert.equal(clientOverview(d, "client").aiReview, undefined);
  d.submissions.push({ ...d.submissions[0], id: "new", revision: 2, status: "changes" });
  assert.equal(clientOverview(d, "client").metrics.review, 0);
});
test("unavailable data does not fabricate zero metrics or AI opportunities", () => {
  for (const field of ["invitationError", "agreementError", "deliveryError"] as const) {
    const d = fixture(); submit(d, "submitted"); d[field] = "Unavailable";
    assert.deepEqual(clientOverview(d, "client").metrics, { active: 1, review: null, response: null, payment: null });
    assert.equal(clientOverview(d, "client").aiReview, undefined);
  }
  const d = fixture(); d.paymentError = "Unavailable";
  assert.equal(clientOverview(d, "client").metrics.payment, null);
});
test("approval needs separate verified payment; zero-value milestones need none", () => {
  const d = fixture(); submit(d, "approved");
  assert.equal(clientOverview(d, "client").metrics.payment, 1);
  d.payments.push({ id: "pay", project_id: "p", agreement_id: "a", milestone_id: "m", submission_id: "s", status: "PAID", last_verified_at: null, reconciliation_status: "SYNCED" });
  assert.equal(clientOverview(d, "client").metrics.payment, 1);
  d.payments[0].last_verified_at = "2026-01-02";
  assert.equal(clientOverview(d, "client").metrics.payment, 0);
  d.payments = []; d.milestones[0].amount = 0;
  assert.equal(clientOverview(d, "client").metrics.payment, 0);
});
