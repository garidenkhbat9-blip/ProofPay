"use client";
import { useRef, useState } from "react";
import { confirmRegistration } from "@/lib/email-confirmation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-validation";

export default function ConfirmEmail() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  async function confirm() {
    if (lock.current || done) return;
    lock.current = true;
    setBusy(true); setError("");
    try {
      const token = new URL(location.href).searchParams.get("token_hash");
      const role = await confirmRegistration(getSupabase(), token);
      history.replaceState(null, "", "/auth/confirm");
      setDone(true);
      location.replace("/dashboard?perspective=" + role);
    } catch (e) { setError(e instanceof Error && ["missing", "session", "identity"].includes(e.message) ? "Confirmation could not be verified. Sign in if already confirmed, or request a new email." : authErrorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="authpage"><section className="authcard"><h1>Confirm your email</h1>
    <p>This link confirms the account that requested registration. Continuing replaces any account signed in in this browser. Use a separate browser profile to keep another account open.</p>
    <button className="primary" disabled={busy || done} onClick={() => void confirm()}>{busy ? "Verifying…" : done ? "Opening workspace…" : "Confirm email and use this account"}</button>
    {error && <p role="alert">{error}</p>}
    <p><Link href="/login">Already confirmed? Sign in</Link></p>
  </section></main>;
}
