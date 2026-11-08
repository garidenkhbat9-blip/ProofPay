import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingInvitations, invitationCountLabel, receivedInvitations } from "../src/lib/invitation-notifications";
import type { Invitation } from "../src/lib/types";

const now = Date.parse("2026-11-07T00:00:00Z");
const user = { id: "recipient", email: "Recipient@example.com", email_confirmed_at: "2026-01-01" };
const invite = (overrides: Partial<Invitation> = {}): Invitation => ({ id: "one", project_id: "project", project_title: "Project", invited_email: "recipient@example.com", invited_by: "client", status: "pending", expires_at: "2026-11-08T00:00:00Z", created_at: "2026-11-06", ...overrides });

test("counts zero, one, two and caps only the display at 9+", () => {
  assert.equal(pendingInvitations([], user, now).length, 0);
  assert.equal(pendingInvitations([invite()], user, now).length, 1);
  assert.equal(pendingInvitations([invite(), invite({ id: "two" })], user, now).length, 2);
  assert.equal(invitationCountLabel(1), "1");
  assert.equal(invitationCountLabel(2), "2");
  assert.equal(invitationCountLabel(10), "9+");
});
test("only pending, valid and strictly unexpired invitations are actionable", () => {
  for (const status of ["accepted", "revoked", "expired", "declined"] as Invitation["status"][]) {
    assert.equal(pendingInvitations([invite({ status })], user, now).length, 0);
  }
  for (const expires_at of [new Date(now).toISOString(), "2020-01-01", "invalid"]) {
    assert.equal(pendingInvitations([invite({ expires_at })], user, now).length, 0);
  }
});
test("verified recipient only; logout and account changes cannot inherit a badge", () => {
  const items = [invite()];
  assert.equal(pendingInvitations(items, null, now).length, 0);
  assert.equal(pendingInvitations(items, { ...user, email_confirmed_at: undefined }, now).length, 0);
  assert.equal(pendingInvitations(items, { ...user, id: "other", email: "other@example.com" }, now).length, 0);
  assert.equal(receivedInvitations(items, user).length, 1);
});
test("visiting invitations never clears pending; confirmed mutation and time expiry do", () => {
  const items = [invite()];
  receivedInvitations(items, user);
  assert.equal(pendingInvitations(items, user, now).length, 1);
  assert.equal(pendingInvitations([invite({ status: "accepted" })], user, now).length, 0);
  assert.equal(pendingInvitations(items, user, now + 86400000).length, 0);
});
