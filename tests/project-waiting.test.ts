import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectWaiting,
  projectEvents,
  deliveryDeadline,
  reminderAvailability,
} from "../src/lib/project-waiting";
import { emptyCloud, type Submission } from "../src/lib/types";
const now = Date.parse("2026-11-08T12:00:00Z");
function fixture() {
  const d = emptyCloud();
  d.projects.push({
    id: "p",
    title: "Website",
    description: "",
    work_category: "website",
    budget_amount: 100,
    currency: "USD",
    due_date: null,
    status: "active",
    created_at: "2026-11-01T00:00:00Z",
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
    created_at: "2026-11-02T00:00:00Z",
  });
  d.approvals.push(
    {
      agreement_id: "a",
      user_id: "client",
      role: "client",
      approved_at: "2026-11-03T00:00:00Z",
    },
    {
      agreement_id: "a",
      user_id: "worker",
      role: "freelancer",
      approved_at: "2026-11-04T00:00:00Z",
    },
  );
  d.milestones.push({
    id: "m",
    agreement_id: "a",
    position: 1,
    title: "Website copy",
    description: "",
    amount: 100,
    due_date: "2026-11-07",
  });
  d.links.push({
    id: "l",
    project_id: "p",
    milestone_id: "m",
    freelancer_id: "worker",
    instructions: "",
    active: true,
    expires_at: "2099-01-01",
    created_at: "2026-11-05T00:00:00Z",
  });
  return d;
}
function submit(
  d: ReturnType<typeof fixture>,
  status: Submission["status"] = "submitted",
) {
  d.submissions.push({
    id: "s",
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "worker",
    revision: 1,
    status,
    notes: "Done",
    created_at: "2026-11-05T00:00:00Z",
    submitted_at: "2026-11-06T00:00:00Z",
  });
  if (status === "changes" || status === "approved")
    d.reviews.push({
      id: "r",
      submission_id: "s",
      reviewed_by: "client",
      decision: status,
      note: "Review decision",
      confirmed_criteria: [],
      created_at: "2026-11-07T00:00:00Z",
    });
}
const model = (d: ReturnType<typeof fixture>, user = "client") =>
  projectWaiting(d, "p", user, now)!;
test("waiting requires actual membership and filters events across project boundaries", () => {
  const d = fixture();
  assert.equal(projectWaiting(d, "p", "outsider", now), null);
  assert.equal(projectWaiting(d, "missing", "client", now), null);
  assert.deepEqual(projectEvents(d, "p", "outsider"), []);
  d.agreements.push({ ...d.agreements[0], id: "other", project_id: "private" });
  d.approvals.push({ ...d.approvals[0], agreement_id: "other" });
  assert(!model(d).events.some((e) => e.id.includes("other")));
  assert.equal(model(d, "worker").role, "freelancer");
});
test("only live pending invitations define invitation waiting; no recipient address is exposed", () => {
  const d = fixture();
  d.members.pop();
  d.invitations.push({
    id: "i",
    project_id: "p",
    project_title: "Website",
    invited_email: "intended@example.test",
    invited_by: "client",
    status: "pending",
    created_at: "2026-11-04",
    expires_at: "2026-11-09",
  });
  const m = model(d);
  assert.equal(m.items[0].kind, "invitation");
  assert.equal(m.items[0].since, "2026-11-04");
  assert.doesNotMatch(JSON.stringify(m), /intended@example/);
  assert.equal(m.canManageInvitation, true);
  d.invitations[0].status = "accepted";
  assert.notEqual(model(d).items[0].kind, "invitation");
  d.invitations[0].status = "pending";
  d.invitations[0].expires_at = "2026-11-07";
  assert.notEqual(model(d).items[0].kind, "invitation");
  d.invitations[0].expires_at = "invalid";
  assert.notEqual(model(d).items[0].kind, "invitation");
});
test("client waits for freelancer delivery using accepted terms and actual link timestamp", () => {
  const d = fixture();
  const m = model(d);
  assert.equal(m.items[0].actor, "Freelancer");
  assert.equal(m.items[0].since, "2026-11-05T00:00:00Z");
  assert.match(m.items[0].dateNote, /Delivery overdue/);
  assert.equal(m.primary.label, "Resolve delay");
  assert.equal(model(d, "worker").primary.label, "Submit your work");
});
test("client review has no invented contractual SLA even when delivery date is past", () => {
  const d = fixture();
  submit(d);
  const m = model(d, "worker");
  assert.equal(m.items[0].kind, "review");
  assert.equal(m.items[0].since, "2026-11-06T00:00:00Z");
  assert.equal(m.items[0].attention, false);
  assert.match(m.items[0].dateNote, /No contractual review-response deadline/);
  assert.equal(model(d).primary.label, "Review submission");
});
test("missing or invalid dates stay neutral; deadline boundaries are UTC calendar dates", () => {
  for (const date of [null, "", "invalid", "2026-02-31"])
    assert.deepEqual(deliveryDeadline(date, now), {
      note: "No delivery deadline recorded",
      attention: false,
    });
  assert.match(deliveryDeadline("2026-11-08", now).note, /today/);
  assert.match(deliveryDeadline("2026-11-11", now).note, /soon/);
  assert.equal(deliveryDeadline("2026-11-12", now).attention, false);
  const d = fixture();
  submit(d);
  d.submissions[0].submitted_at = null;
  assert.equal(model(d).items[0].since, null);
});
test("revision timing comes from review, with no new deadline inferred", () => {
  const d = fixture();
  submit(d, "changes");
  assert.equal(model(d).items[0].since, "2026-11-07T00:00:00Z");
  assert.equal(model(d).items[0].kind, "revision");
  assert.equal(model(d).items[0].attention, false);
  assert.match(model(d).items[0].dateNote, /No separate revision deadline/);
  assert.equal(model(d, "worker").primary.label, "View feedback");
});
test("expired delivery access waits on client, never blames freelancer", () => {
  const d = fixture();
  d.links[0].expires_at = "2026-11-01";
  const m = model(d);
  assert.equal(m.items[0].kind, "access");
  assert.equal(m.items[0].actor, "Client");
  assert.equal(m.primary.label, "Create submission link");
  assert.equal(model(d, "worker").items[0].attention, false);
});
test("payment pending is separate from review and verified settled work has no waiting step", () => {
  const d = fixture();
  submit(d, "approved");
  assert.equal(model(d).items[0].kind, "payment");
  assert.equal(model(d).items[0].since, "2026-11-07T00:00:00Z");
  assert.equal(model(d).items[0].attention, false);
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
  assert.equal(model(d).items.length, 1);
  d.payments[0].last_verified_at = "2026-11-08";
  assert.equal(model(d).items.length, 0);
  d.payments = [];
  d.milestones[0].amount = 0;
  assert.equal(model(d).items.length, 0);
});
test("multiple milestones keep independent waits and actionable review beats overdue delivery", () => {
  const d = fixture();
  submit(d);
  d.milestones.push({
    ...d.milestones[0],
    id: "m2",
    position: 2,
    title: "Second milestone",
    due_date: "2026-11-01",
  });
  d.links.push({ ...d.links[0], id: "l2", milestone_id: "m2" });
  assert.deepEqual(
    model(d).items.map((i) => i.kind),
    ["review", "delivery"],
  );
  assert.equal(model(d).primary.label, "Review submission");
  assert.equal(
    model(d, "worker").primary.href,
    "/projects/p?phase=deliver&handoff=l2",
  );
});
test("equal actionable priorities use persisted deadlines deterministically", () => {
  const d = fixture();
  d.milestones.push({
    ...d.milestones[0],
    id: "m2",
    position: 2,
    due_date: "2026-11-01",
  });
  d.links.push({ ...d.links[0], id: "l2", milestone_id: "m2" });
  assert.equal(
    model(d, "worker").primary.href,
    "/projects/p?phase=deliver&handoff=l2",
  );
  d.milestones.reverse();
  assert.equal(
    model(d, "worker").primary.href,
    "/projects/p?phase=deliver&handoff=l2",
  );
});
test("agreement version change requires fresh consent and does not mutate old terms", () => {
  const d = fixture();
  submit(d);
  d.agreements.push({
    ...d.agreements[0],
    id: "a2",
    version: 2,
    created_at: "2026-11-08",
  });
  d.milestones.push({ ...d.milestones[0], id: "m2", agreement_id: "a2" });
  const before = JSON.stringify(d);
  const m = model(d);
  assert.equal(m.items[0].kind, "agreement");
  assert.equal(m.items[0].actor, "Client & Freelancer");
  assert.equal(m.primary.label, "Review agreement");
  assert.equal(JSON.stringify(d), before);
  d.approvals.push({ ...d.approvals[0], agreement_id: "a2" });
  assert.equal(model(d).items[0].actor, "Freelancer");
  assert.equal(model(d, "worker").primary.priority, 90);
});
test("completed review removes old wait; reminder infrastructure never invents a success or cooldown", () => {
  const d = fixture();
  submit(d);
  assert.equal(model(d, "worker").items[0].kind, "review");
  d.submissions[0].status = "approved";
  assert.equal(model(d, "worker").items[0].kind, "payment");
  assert.equal(reminderAvailability.available, false);
  assert.match(reminderAvailability.message, /No notification or email/);
  for (let i = 0; i < 3; i++) assert.equal(model(d).reminders.available, false);
  assert(!model(d).events.some((e) => /reminder/i.test(e.text)));
});
test("accepted assignments cannot become revoke/reinvite or cancellation actions", () => {
  const d = fixture();
  submit(d, "approved");
  const before = JSON.stringify(d);
  assert.equal(model(d).canManageInvitation, false);
  assert.equal(model(d).hasHistory, true);
  assert.equal(JSON.stringify(d), before);
  d.projects[0].status = "archived";
  assert.deepEqual(model(d).items, []);
  assert.equal(model(d).canManageInvitation, false);
});
test("missing workflow records fail closed without overdue accusations or recovery actions", () => {
  for (const key of [
    "invitationError",
    "agreementError",
    "deliveryError",
  ] as const) {
    const d = fixture();
    d[key] = "unavailable";
    assert.equal(model(d).unavailable, true);
    assert.deepEqual(model(d).items, []);
  }
  const d = fixture();
  submit(d, "approved");
  d.paymentError = "Unavailable";
  assert.match(model(d).items[0].state, /unavailable/);
  assert.equal(model(d).items[0].attention, false);
});
test("activity uses actual timestamps and excludes drafts or unrecorded acceptance times", () => {
  const d = fixture();
  submit(d, "uploading");
  assert(!model(d).events.some((e) => e.id === "submission-s"));
  d.submissions[0].status = "submitted";
  assert(model(d).events.some((e) => e.id === "submission-s"));
  d.approvals[0].approved_at = "";
  assert(!model(d).events.some((e) => e.id === "accept-a-client"));
  assert.equal(model(d).events[0].text, "Website copy · Revision 1 received");
});
