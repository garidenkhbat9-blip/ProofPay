"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useWorkspace } from "@/components/provider";
import { getSupabase } from "@/lib/supabase";
export default function WorkspaceChoice() {
  const { user, ready } = useWorkspace();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function choose(role: "client" | "freelancer") {
    if (lock.current || !user) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const client = getSupabase();
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== user.id || !verified.data.user.email_confirmed_at) throw Error();
      const result = await client.auth.updateUser({ data: { preferred_workspace: role } });
      if (result.error || result.data.user.id !== user.id) throw Error();
      location.replace("/dashboard?perspective=" + role);
    } catch { setError("Your preference could not be saved. Check your session and try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="authpage"><section className="authcard"><h1>Choose your workspace</h1>
    <p>Your Google email is confirmed. Choose how to start. Project membership determines access; this choice grants no permissions.</p>
    {!ready ? <p>Checking session…</p> : !user ? <Link href="/login">Sign in</Link> : <>
      <p>Signed in as {user.email}</p><div className="actions">
      <button className="primary" disabled={busy} onClick={() => void choose("client")}>I’m hiring</button>
      <button disabled={busy} onClick={() => void choose("freelancer")}>I’m freelancing</button></div></>}
    {error && <p role="alert">{error}</p>}
  </section></main>;
}
