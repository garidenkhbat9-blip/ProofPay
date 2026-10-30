import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authErrorMessage,
  validateAuthField,
} from "../src/lib/auth-validation";

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
    assert.match(authErrorMessage({ code }), /already exists/);
  }
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Confirm your email/,
  );
  assert.match(authErrorMessage({ status: 429 }), /Wait a few minutes/);
  assert.match(authErrorMessage({ code: "otp_expired" }), /Request a new link/);
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
