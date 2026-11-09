"use client";
import { useRef, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { authCooldown, deferAuth } from "@/lib/auth-cooldown";
import { authErrorMessage, validateAuthField } from "@/lib/auth-validation";
import { requestReviewerCode, verifyReviewerCode } from "@/lib/reviewer-auth";

export function ReviewerSignIn({
  destination,
  disabled,
  cooldown,
  onVerified,
  onBusy,
}: {
  destination: string;
  disabled: boolean;
  cooldown: number;
  onVerified: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled || (!sent && authCooldown())) return;
    const form = new FormData(event.currentTarget);
    const address = sent
      ? email
      : String(form.get("reviewer_email") || "").trim();
    const invalid = validateAuthField("email", address, "login");
    if (invalid) {
      setError(invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (sent) {
        await verifyReviewerCode(
          getSupabase(),
          email,
          String(form.get("reviewer_code") || ""),
        );
        onVerified();
      } else {
        deferAuth(); // UX only; provider server limits remain authoritative.
        await requestReviewerCode(
          getSupabase(),
          address,
          location.origin,
          destination,
        );
        setEmail(address);
        setSent(true);
        setMessage(
          "If this address has an account, check its inbox. Enter the code from the email. Delivery may take a moment.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message === "invalid_code"
          ? "Enter the six-digit code from your email."
          : e instanceof Error && e.message === "identity"
            ? "Your identity could not be verified. Sign in again."
            : authErrorMessage(e),
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy}>
      <p className="auth-quiet">
        Use your own registered email. No password is needed. This does not
        grant access to a prepared project.
      </p>
      {!sent ? (
        <div className="authfield">
          <label className="formlabel" htmlFor="reviewer-email">
            Email address
          </label>
          <input
            className="field"
            id="reviewer-email"
            name="reviewer_email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={busy || disabled}
          />
        </div>
      ) : (
        <div className="authfield">
          <label className="formlabel" htmlFor="reviewer-code">
            Email code for {email}
          </label>
          <input
            className="field"
            id="reviewer-code"
            name="reviewer_code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            disabled={busy || disabled}
          />
        </div>
      )}
      {message && (
        <p className="authmessage" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="authhint is-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary widebutton"
        disabled={busy || disabled || (!sent && cooldown > 0)}
      >
        {busy
          ? "Please wait…"
          : sent
            ? "Verify code and sign in"
            : cooldown > 0
              ? `Try again in ${cooldown}s`
              : "Email a sign-in code"}
      </button>
      {sent && (
        <button
          type="button"
          disabled={busy || disabled || cooldown > 0}
          onClick={() => {
            setSent(false);
            setMessage("");
            setError("");
          }}
        >
          {cooldown > 0
            ? `New code available in ${cooldown}s`
            : "Request a new code or change email"}
        </button>
      )}
    </form>
  );
}
