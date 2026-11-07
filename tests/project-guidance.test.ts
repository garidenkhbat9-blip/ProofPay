import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCloud, type Project } from "../src/lib/types";
import { agreementGuidance } from "../src/lib/agreement-guidance";
import { projectNextStep } from "../src/lib/project-workflow";
import { projectTotals } from "../src/lib/project-management";
const project: Project = {
  id: "p",
  created_by: "c",
  title: "Draft",
  description: "",
  status: "draft",
  work_category: "website",
  budget_amount: 100,
  currency: "USD",
  due_date: null,
  created_at: "2026-11-01",
};
function fixture() {
  const data = emptyCloud();
  data.projects.push({ ...project });
  data.members.push({ project_id: "p", user_id: "c", role: "client" });
  return data;
}
function agreed() {
  const d = fixture();
  d.members.push({ project_id: "p", user_id: "f", role: "freelancer" });
  d.agreements.push({
    id: "a",
    project_id: "p",
    version: 1,
    scope: "Work",
    change_note: "",
    created_at: "2026-11-01",
  });
  d.milestones.push({
    id: "m",
    agreement_id: "a",
    title: "Work",
    position: 1,
    description: "",
    amount: 100,
    due_date: "2099-01-01",
  });
  d.approvals.push(
    { agreement_id: "a", user_id: "c", role: "client", approved_at: "date" },
    {
      agreement_id: "a",
      user_id: "f",
      role: "freelancer",
      approved_at: "date",
    },
  );
  return d;
}
test("draft preparation is client-only before assignment; invitations never stand in for membership", () => {
  const d = fixture();
  assert(agreementGuidance(d, project, "c").canDraft);
  for (const status of ["revoked", "pending", "accepted", "expired"] as const) {
    d.invitations = [
      {
        id: "i",
        project_id: "p",
        project_title: "Draft",
        invited_by: "c",
        invited_email: "f@example.test",
        status,
        created_at: "date",
        expires_at: "2099-01-01",
      },
    ];
    const guidance = agreementGuidance(d, project, "c");
    assert.equal(guidance.invitation, status);
    assert.equal(guidance.hasFreelancer, false);
    assert.equal(
      projectNextStep(d, project, "c")?.stage,
      status === "accepted" ? -1 : 0,
    );
    if (status === "accepted")
      assert.equal(projectNextStep(d, project, "c")?.action, undefined);
  }
  assert.equal(agreementGuidance(d, project, "o").canDraft, false);
  d.members.push({ project_id: "p", user_id: "f", role: "freelancer" });
  assert.equal(agreementGuidance(d, project, "f").canDraft, false);
  assert.equal(
    agreementGuidance(d, { ...project, status: "archived" }, "c").canDraft,
    false,
  );
});
test("latest agreement and actual milestones gate delivery independently", () => {
  const d = agreed();
  const approvals = [...d.approvals];
  d.approvals = [approvals[0]];
  assert.equal(projectNextStep(d, project, "c")!.actor, "Freelancer");
  assert.equal(projectNextStep(d, project, "c")!.attention, false);
  d.approvals = [approvals[1]];
  assert.equal(projectNextStep(d, project, "f")!.actor, "Client");
  assert.equal(projectNextStep(d, project, "c")!.attention, true);
  d.approvals = approvals;
  d.milestones = [];
  assert.match(
    projectNextStep(d, project, "c")!.title,
    /at least one milestone/,
  );
  assert.equal(projectNextStep(d, project, "c")!.stages![2].state, "blocked");
  d.agreements.push({ ...d.agreements[0], id: "a2", version: 2 });
  assert.equal(projectNextStep(d, project, "f")!.stage, 1);
  assert.equal(projectNextStep(d, project, "outsider"), null);
});
test("partial delivery never marks every stage complete; approved evidence never implies paid", () => {
  const d = agreed();
  d.milestones.push({ ...d.milestones[0], id: "m2", position: 2 });
  d.submissions.push({
    id: "s",
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "f",
    revision: 1,
    status: "submitted",
    notes: "",
    created_at: "date",
    submitted_at: "date",
  });
  let step = projectNextStep(d, project, "c")!;
  assert.equal(step.stage, 3);
  assert.notEqual(step.stages![2].state, "complete");
  assert.equal(step.stages![3].state, "current");
  d.submissions[0].status = "approved";
  d.milestones.pop();
  step = projectNextStep(d, project, "c")!;
  assert.equal(step.stage, 5);
  assert.equal(step.stages![4].state, "complete");
  assert.equal(step.stages![5].state, "current");
  d.payments.push({
    id: "pay",
    project_id: "p",
    milestone_id: "m",
    agreement_id: "a",
    submission_id: "s",
    status: "PAID",
    last_verified_at: "date",
    reconciliation_status: "SYNCED",
  });
  assert.equal(projectNextStep(d, project, "c")!.stages![5].state, "complete");
  for (const patch of [
    { status: "REFUNDED" },
    { status: "UNPAID" },
    { status: "PAID", reconciliation_status: "ERROR" },
    { reconciliation_status: "SYNCED", submission_id: "old" },
  ]) {
    Object.assign(d.payments[0], patch);
    assert.notEqual(
      projectNextStep(d, project, "c")!.stages![5].state,
      "complete",
    );
  }
});
test("active counts and planned budgets exclude archives and restore on reopening", () => {
  const projects = [
    { ...project },
    {
      ...project,
      id: "archived",
      status: "archived" as const,
      budget_amount: 700,
    },
  ];
  assert.deepEqual(projectTotals(projects), {
    active: 1,
    archived: 1,
    plannedBudget: 100,
  });
  projects[0].status = "archived";
  assert.equal(projectTotals(projects).plannedBudget, 0);
  projects[0].status = "draft";
  assert.equal(projectTotals(projects).plannedBudget, 100);
});

test("zero-value work needs no payment and unavailable records never imply completion", () => {
  const d = agreed();
  d.milestones[0].amount = 0;
  d.submissions.push({
    id: "s",
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "f",
    revision: 1,
    status: "approved",
    notes: "",
    created_at: "date",
    submitted_at: "date",
  });
  const step = projectNextStep(d, project, "c")!;
  assert.equal(step.status, "No payment required");
  assert.equal(step.stages![5].state, "complete");
  d.deliveryError = "Unavailable";
  assert(
    projectNextStep(d, project, "c")!.stages!.every(
      (s) => s.state === "blocked",
    ),
  );
  d.deliveryError = "";
  d.milestones[0].amount = 100;
  d.paymentError = "Payment status unavailable";
  assert.equal(projectNextStep(d, project, "c")!.stages![5].state, "blocked");
});
