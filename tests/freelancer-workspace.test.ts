import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freelancerWorkspace,
  deadlineLabel,
} from "../src/lib/freelancer-workspace";
import { emptyCloud, type Submission } from "../src/lib/types";

const now = Date.parse("2026-11-07T12:00:00Z");
function fixture() {
  const d = emptyCloud();
  d.projects.push({
    id: "p",
    title: "Real job",
    created_by: "client",
    description: "",
    work_category: "website",
    budget_amount: 100,
    currency: "USD",
    due_date: "2026-11-10",
    status: "active",
    created_at: "2026-01-01",
  });
  d.members.push(
    { project_id: "p", user_id: "client", role: "client" },
    { project_id: "p", user_id: "worker", role: "freelancer" },
  );
  d.profiles.push({ id: "client", full_name: "Client Name" });
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
    due_date: "2026-11-09",
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
test("empty and other-role accounts never inherit freelancer jobs or client names", () => {
  for (const id of [undefined, "other", "client"])
    assert.equal(freelancerWorkspace(fixture(), id, now).jobs.length, 0);
  const empty = freelancerWorkspace(emptyCloud(), "worker", now);
  assert.equal(empty.next, undefined);
  assert.equal(empty.deliveryCount, 0);
  assert.equal(
    freelancerWorkspace(fixture(), "worker", now).jobs[0].clientName,
    "Client Name",
  );
  const d = fixture();
  d.profiles = [];
  assert.equal(
    freelancerWorkspace(d, "worker", now).jobs[0].clientName,
    "Your client",
  );
});
test("delivery links require accepted current agreement, valid expiry and matching freelancer", () => {
  const d = fixture();
  let m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.deliveryCount, 1);
  assert.equal(m.next?.href, "/handoff/l");
  assert.equal(m.next?.actor, "Your action");
  d.links[0].expires_at = new Date(now).toISOString();
  assert.equal(freelancerWorkspace(d, "worker", now).deliveryCount, 0);
  d.links[0].expires_at = "2099-01-01";
  d.links[0].freelancer_id = "other";
  assert.equal(freelancerWorkspace(d, "worker", now).deliveryCount, 0);
  d.links[0].freelancer_id = "worker";
  d.approvals = [];
  m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.deliveryCount, 0);
  assert.equal(m.next?.status, "Agreement pending");
});
test("client acceptance and review are distinct waiting states", () => {
  const d = fixture();
  d.approvals = d.approvals.filter((a) => a.role === "freelancer");
  let m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.next?.status, "Waiting for client acceptance");
  assert.equal(m.waitingCount, 1);
  const submitted = fixture();
  submit(submitted, "submitted");
  m = freelancerWorkspace(submitted, "worker", now);
  assert.equal(m.next?.status, "Waiting for client review");
  assert.equal(m.next?.priority, 0);
  assert.equal(m.deliveryCount, 0);
});
test("revision action uses latest revision and becomes waiting after resubmission", () => {
  const d = fixture();
  submit(d, "changes");
  assert.equal(
    freelancerWorkspace(d, "worker", now).next?.status,
    "Changes requested",
  );
  assert.equal(
    freelancerWorkspace(d, "worker", now).next?.label,
    "Revise delivery",
  );
  d.submissions.push({
    ...d.submissions[0],
    id: "s2",
    revision: 2,
    status: "submitted",
  });
  assert.equal(
    freelancerWorkspace(d, "worker", now).next?.status,
    "Waiting for client review",
  );
});
test("one milestone awaiting review does not hide another delivery; metrics count jobs", () => {
  const d = fixture();
  submit(d, "submitted");
  d.milestones.push({ ...d.milestones[0], id: "m2", position: 2 });
  d.links.push({ ...d.links[0], id: "l2", milestone_id: "m2" });
  const m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.next?.href, "/handoff/l2");
  assert.equal(m.deliveryCount, 1);
  assert.equal(m.waitingCount, 1);
});
test("multiple jobs rank revision before ordinary delivery and retain archived records", () => {
  const d = fixture();
  d.projects.push({
    ...d.projects[0],
    id: "p2",
    title: "Older revision",
    created_at: "2025-01-01",
  });
  d.members.push({ project_id: "p2", user_id: "worker", role: "freelancer" });
  d.agreements.push({ ...d.agreements[0], id: "a2", project_id: "p2" });
  d.approvals.push(...d.approvals.map((a) => ({ ...a, agreement_id: "a2" })));
  d.milestones.push({ ...d.milestones[0], id: "m2", agreement_id: "a2" });
  d.links.push({
    ...d.links[0],
    id: "l2",
    project_id: "p2",
    milestone_id: "m2",
  });
  submit(d, "changes");
  d.submissions[0] = {
    ...d.submissions[0],
    project_id: "p2",
    milestone_id: "m2",
    link_id: "l2",
  };
  assert.equal(freelancerWorkspace(d, "worker", now).next?.project.id, "p2");
  d.projects[1].status = "archived";
  const m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.jobs.length, 2);
  assert.equal(m.active.length, 1);
  assert.equal(m.next?.project.id, "p");
});
test("paid labels require matching backend verified records; approval alone is not earnings", () => {
  const d = fixture();
  submit(d, "approved");
  assert.equal(freelancerWorkspace(d, "worker", now).paymentCount, 1);
  d.payments.push({
    id: "pay",
    project_id: "p",
    agreement_id: "a",
    milestone_id: "m",
    submission_id: "s",
    status: "PAID",
    reconciliation_status: "SYNCED",
    last_verified_at: null,
  });
  assert.equal(freelancerWorkspace(d, "worker", now).next?.paid, false);
  d.payments[0].last_verified_at = "2026-11-07";
  assert.equal(
    freelancerWorkspace(d, "worker", now).next?.status,
    "Paid · Sandbox verified",
  );
  d.payments[0].submission_id = "old";
  assert.equal(freelancerWorkspace(d, "worker", now).next?.paid, false);
});
test("failed records show unavailable metrics instead of misleading zero", () => {
  const d = fixture();
  d.deliveryError = "Offline";
  const m = freelancerWorkspace(d, "worker", now);
  assert.equal(m.deliveryCount, null);
  assert.equal(m.waitingCount, null);
  assert.equal(m.paymentCount, null);
  assert.equal(m.next?.deliveries.length, 0);
  d.deliveryError = "";
  d.paymentError = "Unavailable";
  assert.equal(freelancerWorkspace(d, "worker", now).paymentCount, null);
});
test("deadline copy is based only on valid stored calendar dates", () => {
  assert.equal(deadlineLabel(null, now), null);
  assert.equal(deadlineLabel("invalid", now), null);
  assert.equal(deadlineLabel("2026-11-07", now), "Due today");
  assert.equal(deadlineLabel("2026-11-09", now), "Due soon · 2026-11-09");
  assert.equal(deadlineLabel("2026-11-06", now), "Past due · 2026-11-06");
  assert.equal(deadlineLabel("2026-12-01", now), "Due 2026-12-01");
});
