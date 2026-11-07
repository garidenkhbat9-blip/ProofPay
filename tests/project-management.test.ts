import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyCloud, type Project, type Invitation } from "../src/lib/types";
import { projectTeam, workspaceProjects } from "../src/lib/project-management";

const project: Project = {
  id: "p",
  title: "Owned draft",
  description: "",
  status: "draft",
  work_category: "website",
  budget_amount: 100,
  currency: "USD",
  due_date: null,
  created_at: "2026-11-01",
};
const invite: Invitation = {
  id: "i",
  project_id: "p",
  project_title: "Owned draft",
  invited_by: "owner",
  invited_email: "worker@example.test",
  status: "revoked",
  expires_at: "2099-01-01",
  created_at: "2026-11-01",
};

test("project visibility includes all owned projects and archives, but no unrelated or freelancer-owned projects", () => {
  const data = emptyCloud();
  data.projects.push(
    project,
    { ...project, id: "archived", status: "archived" },
    { ...project, id: "job" },
    { ...project, id: "unrelated" },
  );
  data.members.push(
    { project_id: "p", user_id: "owner", role: "client" },
    { project_id: "archived", user_id: "owner", role: "client" },
    { project_id: "job", user_id: "owner", role: "freelancer" },
  );
  assert.deepEqual(
    workspaceProjects(data, "owner", "client")
      .map((p) => p.id)
      .sort(),
    ["archived", "p"],
  );
  assert.deepEqual(
    workspaceProjects(data, "owner", "freelancer").map((p) => p.id),
    ["job"],
  );
  assert.equal(workspaceProjects(data, "outsider", "client").length, 0);
  assert.equal(workspaceProjects(data, undefined, "client").length, 0);
});

test("revoked and expired invitations cannot be displayed as pending", () => {
  const data = emptyCloud();
  data.invitations.push(invite);
  assert.equal(projectTeam(data, "p").invitation, "revoked");
  data.invitations[0] = {
    ...invite,
    status: "pending",
    expires_at: "2020-01-01",
  };
  assert.equal(projectTeam(data, "p").invitation, "expired");
  data.invitations.push({
    ...invite,
    id: "current",
    status: "pending",
    created_at: "2026-11-02",
  });
  assert.equal(projectTeam(data, "p").invitation, "pending");
  data.invitationError = "unavailable";
  assert.equal(projectTeam(data, "p").invitation, "Unavailable");
});

test("assigned freelancer resolves from project membership and profile", () => {
  const data = emptyCloud();
  assert.equal(projectTeam(data, "p").freelancer, "Not assigned");
  data.members.push({ project_id: "p", user_id: "worker", role: "freelancer" });
  assert.equal(projectTeam(data, "p").freelancer, "Assigned freelancer");
  data.profiles.push({ id: "worker", full_name: "Ada" });
  assert.equal(projectTeam(data, "p").freelancer, "Ada");
});
