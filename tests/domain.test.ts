import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCloud } from "../src/lib/types";
import {
  activeLink,
  bothAccepted,
  invitationStatus,
  legacyPath,
  memberRole,
  reviewable,
  revisions,
  safeReturn,
  safeUrl,
  validateAgreement,
  validateEvidence,
  currentDeliveries,
} from "../src/lib/domain";
import type {
  CloudData,
  MilestoneDraft,
  SubmissionLink,
} from "../src/lib/types";
const link: SubmissionLink = {
  id: "l",
  milestone_id: "m",
  project_id: "p",
  freelancer_id: "worker",
  active: true,
  instructions: "Deliver source",
  expires_at: "2099-01-01",
  created_at: "2026-01-01",
};
function fixture(): CloudData {
  return {
    ...emptyCloud(),
    projects: [
      {
        id: "p",
        title: "Website",
        description: "Build",
        budget_amount: 100,
        due_date: "2027-01-01",
        status: "active",
        currency: "USD",
        work_category: "website",
        created_at: "2026-01-01",
      },
    ],
    members: [
      { project_id: "p", user_id: "client", role: "client" },
      { project_id: "p", user_id: "worker", role: "freelancer" },
    ],
    agreements: [
      {
        id: "a",
        project_id: "p",
        version: 1,
        scope: "Scope",
        change_note: "",
        created_at: "2026-01-01",
      },
    ],
    milestones: [
      {
        id: "m",
        agreement_id: "a",
        position: 1,
        title: "Deliver",
        description: "Source",
        amount: 100,
        due_date: "2027-01-01",
      },
    ],
    approvals: [
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
    ],
  };
}
test("workspace perspective never grants project membership", () => {
  const d = fixture();
  assert.equal(memberRole(d, "p", "worker"), "freelancer");
  assert.equal(memberRole(d, "p", "outsider"), undefined);
  assert.equal(memberRole(d, "another-project", "client"), undefined);
});
test("dashboard counts latest agreement milestones and latest submitted revisions only", () => {
  const d = fixture();
  d.agreements.push({ ...d.agreements[0], id: "a2", version: 2 });
  d.milestones.push({ ...d.milestones[0], id: "m2", agreement_id: "a2" });
  d.submissions = [
    { id: "old", milestone_id: "m", revision: 1, status: "approved" as const },
    { id: "changes", milestone_id: "m2", revision: 1, status: "changes" as const },
    { id: "current", milestone_id: "m2", revision: 2, status: "submitted" as const },
    { id: "draft", milestone_id: "m2", revision: 3, status: "uploading" as const },
  ].map((s) => ({ ...s, project_id: "p", link_id: "l", submitted_by: "worker", notes: "", created_at: "2026-01-01", submitted_at: null }));
  assert.deepEqual(currentDeliveries(d, ["p"]).map((s) => s.id), ["current"]);
  assert.deepEqual(currentDeliveries(d, ["unrelated"]), []);
});

test("evidence URLs normalize to the SQL web scheme constraint", () => {
  assert.equal(safeUrl("HTTPS://EXAMPLE.COM/work"), "https://example.com/work");
  assert.equal(validateEvidence([], ["HTTPS://EXAMPLE.COM/work"]), "");
  for (const url of ["https:example.com", "//example.com"])
    assert(validateEvidence([], [url]));
  assert(validateEvidence([], ["https://example.com/" + "é".repeat(400)]));
});
test("delivery requires both distinct project roles to accept", () => {
  const d = fixture();
  assert(bothAccepted(d, "a"));
  assert(activeLink(d, link));
  d.approvals[1] = { ...d.approvals[1], role: "client" };
  assert(!bothAccepted(d, "a"));
  assert(!activeLink(d, link));
});
test("revoked or expired links block submission, while received evidence can still be reviewed", () => {
  const d = fixture();
  assert(!activeLink(d, { ...link, active: false }));
  assert(!activeLink(d, { ...link, expires_at: "2020-01-01" }));
  assert(reviewable(d, { ...link, active: false }));
});
test("superseded agreements and archived projects cannot receive or approve new work", () => {
  const d = fixture();
  d.agreements.push({ ...d.agreements[0], id: "a2", version: 2 });
  assert(!reviewable(d, link));
  d.agreements.pop();
  d.projects[0].status = "archived";
  assert(!reviewable(d, link));
});
test("submission revisions are ordered numerically", () => {
  const d = fixture();
  d.submissions = [2, 10, 1].map((revision) => ({
    id: String(revision),
    project_id: "p",
    milestone_id: "m",
    link_id: "l",
    submitted_by: "worker",
    revision,
    status: "submitted",
    notes: "",
    created_at: "2026-01-01",
    submitted_at: "2026-01-01",
  }));
  assert.deepEqual(
    revisions(d, "m").map((s) => s.revision),
    [10, 2, 1],
  );
});
test("evidence rejects missing, oversized, excessive and unsafe inputs", () => {
  assert(validateEvidence([], []));
  assert(validateEvidence([{ size: 20971521 }], []));
  assert(
    validateEvidence(
      Array.from({ length: 11 }, () => ({ size: 1 })),
      [],
    ),
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,test",
  ])
    assert(validateEvidence([], [url]));
  assert.equal(validateEvidence([{ size: 100 }], ["https://example.com"]), "");
  assert.equal(safeUrl("javascript:alert(1)"), null);
});
test("agreement validation preserves money totals and revision notes", () => {
  const m: MilestoneDraft = {
    title: "Build",
    description: "Deliver",
    amount: 100,
    due_date: "2027-01-01",
    criteria: ["Mobile layout"],
  };
  assert.equal(validateAgreement("Scope", "", [m], 100, false), "");
  assert(validateAgreement("Scope", "", [m], 100, true));
  assert(
    validateAgreement("Scope", "Changed", [{ ...m, amount: 99 }], 100, true),
  );
  assert(validateAgreement("Scope", "", [{ ...m, criteria: [] }], 100, false));
  assert(validateAgreement("Scope", "", [{ ...m, amount: 1.001 }], 100, false));
});
test("authentication return paths cannot redirect to external origins", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    null,
  ])
    assert.equal(safeReturn(value), "/dashboard");
  assert.equal(safeReturn("/handoff/abc-123"), "/handoff/abc-123");
  assert.equal(
    safeReturn("/projects/p/agreement?version=v1"),
    "/projects/p/agreement?version=v1",
  );
});
test("legacy delivery, project and reset links migrate without touching auth token hashes", () => {
  assert.equal(legacyPath("#handoff/abc"), "/handoff/abc");
  assert.equal(
    legacyPath("#project/p/agreement/v1"),
    "/projects/p/agreement?version=v1",
  );
  assert.equal(legacyPath("#reports"), "/reviews");
  assert.equal(legacyPath("#access_token=secret&type=recovery"), null);
});
test("expired invitations cannot appear pending", () => {
  assert.equal(
    invitationStatus({
      id: "i",
      project_id: "p",
      project_title: "P",
      invited_email: "a@example.com",
      invited_by: "c",
      status: "pending",
      expires_at: "2020-01-01",
      created_at: "2019-01-01",
    }),
    "expired",
  );
});
