import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCloud, type Submission } from "../src/lib/types";
import {
  judgeDestination,
  judgeProjectIds,
  judgeProjects,
  judgeProgress,
  judgeRole,
  entryPerspective,
  legacyJudgeDestination,
} from "../src/lib/judge-access";
import { safeReturn } from "../src/lib/domain";

const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const data = emptyCloud();
  data.projects.push({
    id,
    title: "Sandbox project",
    description: "",
    work_category: "website",
    budget_amount: 100,
    due_date: null,
    status: "active",
    currency: "USD",
    created_at: "2026-01-01",
  });
  data.members.push(
    { project_id: id, user_id: "client", role: "client" },
    { project_id: id, user_id: "worker", role: "freelancer" },
  );
  data.agreements.push({
    id: "a1",
    project_id: id,
    version: 1,
    scope: "Work",
    change_note: "",
    created_at: "2026-01-01",
  });
  data.milestones.push({
    id: "m1",
    agreement_id: "a1",
    position: 1,
    title: "Deliver",
    description: "",
    amount: 100,
    due_date: "2026-12-01",
  });
  return data;
}
function submission(
  revision: number,
  status: Submission["status"],
): Submission {
  return {
    id: `s${revision}`,
    project_id: id,
    milestone_id: "m1",
    link_id: "link",
    submitted_by: "worker",
    revision,
    status,
    notes: "",
    created_at: "2026-01-01",
    submitted_at: "2026-01-01",
  };
}

test("judge navigation preserves the chosen view without allowing external return destinations", () => {
  for (const role of ["client", "freelancer"] as const)
    assert.equal(safeReturn(judgeDestination(role)), judgeDestination(role));
  for (const invalid of [
    "https://evil.test",
    "//evil.test",
    "/judge-workspace/../api/payments",
    "/judge-workspace#evil",
    "/judge-access",
    "/judge-workspace\\evil",
  ])
    assert.equal(safeReturn(invalid), "/dashboard");
  for (const invalid of ["admin", "CLIENT", ["client"], null, undefined])
    assert.equal(judgeRole(invalid), null);
});

test("both public choices enter the real dashboard and old judge URLs retain valid intent", () => {
  for (const role of ["client", "freelancer"] as const) {
    assert.equal(judgeDestination(role), `/dashboard?perspective=${role}`);
    assert.equal(legacyJudgeDestination(role), judgeDestination(role));
    assert.equal(entryPerspective(judgeDestination(role)), role);
    assert.equal(entryPerspective(`/judge-workspace?perspective=${role}`), role);
  }
  for (const invalid of [null, undefined, "admin", ["client", "freelancer"]])
    assert.equal(legacyJudgeDestination(invalid), "/dashboard");
  for (const invalid of ["/dashboard?perspective=admin", "/dashboard?perspective=client&perspective=freelancer", "/projects/p?perspective=client", "https://evil.test/dashboard?perspective=client"])
    assert.equal(entryPerspective(invalid), null);
});

test("an absent or invalid judge configuration fails closed instead of selecting arbitrary projects", () => {
  assert.deepEqual(judgeProjectIds(undefined), []);
  assert.deepEqual(judgeProjectIds(`${id},not-a-uuid`), []);
  assert.deepEqual(judgeProjectIds(` ${id},${id} `), [id]);
  assert.deepEqual(judgeProjects(fixture(), [], "client", "client"), []);
});

test("judge projects require both designation and actual membership in the selected role", () => {
  const data = fixture();
  assert.equal(judgeProjects(data, [id], "client", "client").length, 1);
  assert.equal(judgeProjects(data, [id], "worker", "freelancer").length, 1);
  assert.deepEqual(judgeProjects(data, [id], "client", "freelancer"), []);
  assert.deepEqual(judgeProjects(data, [id], "stranger", "client"), []);
  assert.deepEqual(judgeProjects(data, [id], undefined, "client"), []);
  const other = { ...data.projects[0], id: "other-project" };
  data.projects.push(other);
  data.members.push({
    project_id: other.id,
    user_id: "client",
    role: "client",
  });
  assert.deepEqual(
    judgeProjects(data, [id], "client", "client").map((p) => p.id),
    [id],
  );
});

test("judge progress uses current immutable agreement and latest submitted revisions", () => {
  const data = fixture();
  assert.match(judgeProgress(data, id).agreement, /Awaiting acceptance/);
  data.submissions.push(
    submission(1, "approved"),
    submission(2, "changes"),
    submission(3, "uploading"),
  );
  assert.equal(judgeProgress(data, id).evidence, "1 of 1 milestones submitted");
  assert.equal(judgeProgress(data, id).review, "0 of 1 milestones approved");
  data.agreements.push({ ...data.agreements[0], id: "a2", version: 2 });
  data.milestones.push({ ...data.milestones[0], id: "m2", agreement_id: "a2" });
  assert.match(judgeProgress(data, id).agreement, /v2/);
  assert.equal(judgeProgress(data, id).evidence, "0 of 1 milestones submitted");
});

test("missing records and partial failures never invent completed progress", () => {
  const data = fixture();
  data.agreements = [];
  data.milestones = [];
  assert.equal(judgeProgress(data, id).agreement, "Not created");
  assert.equal(judgeProgress(data, id).review, "0 of 0 milestones approved");
  data.agreementError = "Unavailable";
  assert.deepEqual(Object.values(judgeProgress(data, id)), [
    "Status unavailable",
    "Status unavailable",
    "Status unavailable",
  ]);
  data.agreementError = "";
  data.deliveryError = "Unavailable";
  assert.equal(judgeProgress(data, id).evidence, "Status unavailable");
});
