import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCloud } from "../src/lib/types";
import { projectNextStep } from "../src/lib/project-workflow";
function fixture() {
  const data = emptyCloud();
  data.projects.push({
    id: "p",
    title: "Website",
    description: "Three pages",
    work_category: "website",
    budget_amount: 1200,
    due_date: null,
    status: "active",
    currency: "USD",
    created_at: "2026-01-01",
  });
  data.members.push(
    { project_id: "p", user_id: "client", role: "client" },
    { project_id: "p", user_id: "freelancer", role: "freelancer" },
  );
  data.agreements.push({
    id: "a",
    project_id: "p",
    version: 1,
    scope: "Website",
    change_note: "",
    created_at: "2026-01-01",
  });
  data.approvals.push(
    {
      agreement_id: "a",
      user_id: "client",
      role: "client",
      approved_at: "2026-01-01",
    },
    {
      agreement_id: "a",
      user_id: "freelancer",
      role: "freelancer",
      approved_at: "2026-01-01",
    },
  );
  data.milestones.push({
    id: "m",
    agreement_id: "a",
    position: 1,
    title: "Website",
    description: "",
    amount: 1200,
    due_date: "2026-01-14",
  });
  data.links.push({
    id: "l",
    project_id: "p",
    milestone_id: "m",
    freelancer_id: "freelancer",
    instructions: "",
    active: true,
    expires_at: "2099-01-01",
    created_at: "2026-01-01",
  });
  return data;
}
test("next actions use project membership rather than a workspace perspective", () => {
  const data = fixture();
  const project = data.projects[0];
  assert.equal(projectNextStep(data, project, "outsider"), null);
  assert.equal(
    projectNextStep(data, project, "freelancer")?.label,
    "Submit work",
  );
  assert.equal(projectNextStep(data, project, "client")?.label, "View handoff");
});
test("a superseding agreement blocks delivery until fresh acceptance", () => {
  const data = fixture();
  data.agreements.push({ ...data.agreements[0], id: "a2", version: 2 });
  assert.equal(projectNextStep(data, data.projects[0], "freelancer")?.stage, 1);
});
test("received work requires human review and approval never implies payment", () => {
  const data = fixture();
  data.submissions.push({
    id: "s",
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "freelancer",
    revision: 1,
    status: "submitted",
    notes: "",
    created_at: "2026-01-01",
    submitted_at: "2026-01-02",
  });
  const client = projectNextStep(data, data.projects[0], "client");
  assert.equal(client?.label, "Review & approve");
  assert.match(client?.description || "", /not connected/);
  data.submissions[0].status = "changes";
  assert.equal(
    projectNextStep(data, data.projects[0], "freelancer")?.label,
    "Fix & resubmit",
  );
  data.submissions[0].status = "approved";
  assert.equal(
    projectNextStep(data, data.projects[0], "client")?.status,
    "Approved · check payment status",
  );
});
test("expired links and incomplete data do not present an actionable submit link", () => {
  const data = fixture();
  data.links[0].expires_at = "2020-01-01";
  assert.equal(
    projectNextStep(data, data.projects[0], "freelancer")?.label,
    "View delivery status",
  );
  data.deliveryError = "Unavailable";
  assert.equal(
    projectNextStep(data, data.projects[0], "client")?.status,
    "Status unavailable",
  );
});
