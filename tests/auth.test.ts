import { test } from "node:test";
import assert from "node:assert/strict";
import { authenticationReturn, needsAccountConfirmation } from "../src/lib/auth-navigation";
import {
  authErrorMessage,
  validateAuthField,
} from "../src/lib/auth-validation";

test("exploration requires an existing account to be acknowledged, never silently switched", () => {
  for (const role of ["client", "freelancer"]) {
    const next = `/dashboard?perspective=${role}`;
    assert.equal(needsAccountConfirmation(next, "account-a", false, null), true);
    assert.equal(needsAccountConfirmation(next, "account-a", false, "account-a"), false);
    assert.equal(needsAccountConfirmation(next, "account-b", false, "account-a"), true);
    assert.equal(needsAccountConfirmation(next, "account-a", true, null), false);
    assert.equal(needsAccountConfirmation(next, undefined, false, null), false);
  }
  assert.equal(needsAccountConfirmation("/projects/p", "account-a", false, null), true);
});

test("authentication retains role and project return paths while explicit intent takes priority", () => {
  const pending = "/dashboard?perspective=client";
  assert.equal(authenticationReturn("/dashboard?perspective=freelancer", pending), "/dashboard?perspective=freelancer");
  assert.equal(authenticationReturn(null, pending), pending);
  assert.equal(authenticationReturn("/projects/p/agreement?version=a", pending), "/projects/p/agreement?version=a");
  for (const invalid of ["https://evil.test", "//evil.test", "/login", "/api/payments", "/dashboard/../api/payments", "/dashboard#external"])
    assert.equal(authenticationReturn(invalid, pending), "/dashboard");
});

test("new passwords require eight characters without extra composition rules", () => {
  for (const mode of ["signup", "reset"] as const) {
    assert(validateAuthField("password", "1234567", mode));
    for (const password of [
      "12345678",
      "abcdefgh",
      "two words",
      " あいうえおかき",
    ]) {
      assert.equal(validateAuthField("password", password, mode), "");
    }
  }
});

test("sign-in accepts existing short passwords but rejects an empty password", () => {
  assert.equal(validateAuthField("password", "old", "login"), "");
  assert(validateAuthField("password", "", "login"));
});

test("email and name validation handle blank and malformed input", () => {
  for (const email of ["", " ", "missing-at", "name@", "a b@example.com"]) {
    assert(validateAuthField("email", email, "signup"));
  }
  assert.equal(
    validateAuthField("email", " name+work@example.com ", "login"),
    "",
  );
  assert(validateAuthField("full_name", "   ", "signup"));
  assert.equal(validateAuthField("full_name", " Test User ", "signup"), "");
});

test("authentication failures give actionable feedback without exposing internal errors", () => {
  assert.match(
    authErrorMessage({ code: "invalid_credentials" }),
    /email or password is incorrect/,
  );
  for (const code of ["email_exists", "user_already_exists"]) {
    assert.match(authErrorMessage({ code }), /If you already registered/);
  }
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Confirm your email/,
  );
  assert.match(authErrorMessage({ status: 429 }), /Wait a few minutes/);
  assert.match(authErrorMessage({ code: "otp_expired" }), /request a new link/);
  assert.equal(
    authErrorMessage({
      code: "weak_password",
      message: "Use at least 12 characters.",
    }),
    "Use at least 12 characters.",
  );
  assert.doesNotMatch(
    authErrorMessage(new Error("internal database details")),
    /database/,
  );
  assert.match(authErrorMessage(null), /try again/);
});
