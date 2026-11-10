"use client";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/provider";
import { Icon } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { oauthDestination, workspaceIntent, type WorkspaceIntent } from "@/lib/google-auth";
import { saveWorkspacePreference } from "@/lib/workspace-preference";
export default function WorkspaceChoice() {
  const { user, ready } = useWorkspace();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceIntent | null>(null);
  const userId = user?.id;
  useEffect(() => {
    let alive = true;
    setChecked(null); setRole(null); setError("");
    if (!userId) return;
    void getSupabase().auth.getUser().then(({ data, error }) => {
      if (!alive) return;
      if (error || data.user?.id !== userId || !data.user.email_confirmed_at) {
        setError("Your session could not be verified. Please sign in again."); return;
      }
      const preferred = workspaceIntent(data.user.user_metadata?.preferred_workspace);
      if (preferred) location.replace(oauthDestination(preferred));
      else setChecked(userId);
    }).catch(() => { if (alive) setError("Your session could not be verified. Please sign in again."); });
    return () => { alive = false; };
  }, [userId]);
  async function choose() {
    if (lock.current || !user || !role || checked !== user.id) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await saveWorkspacePreference(getSupabase(), user.id, role);
      location.replace(oauthDestination(role));
    } catch { setError("Your preference could not be saved. Check your session and try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="workspace-onboarding-page"><section className="workspace-onboarding-card" aria-labelledby="workspace-title">
    <Brand /><h1 id="workspace-title">Choose your workspace</h1>
    <p>Choose how you want to start. You can switch views later in Account.</p>
    {error && <p role="alert">{error} <Link href="/login">Sign in</Link></p>}
    {!ready || (user && checked !== user.id && !error) ? <p role="status">Checking your workspace…</p> : !user ? <Link href="/login">Sign in</Link> : checked === user.id && <>
      <p className="workspace-account">Signed in as <strong>{user.email}</strong></p>
      <div className="workspace-options" role="group" aria-label="Workspace preference">
        {(["client", "freelancer"] as const).map(option => <button key={option} type="button" aria-pressed={role === option} disabled={busy} onClick={() => setRole(option)}>
          <Icon name={option === "client" ? "briefcase" : "user"}/><span><strong>{option === "client" ? "Client" : "Freelancer"}</strong><small>{option === "client" ? "Hire talent and review delivered work." : "Find invitations and deliver your work."}</small></span>
        </button>)}
      </div><button className="primary widebutton" disabled={!role || busy} aria-busy={busy} onClick={() => void choose()}>{busy ? "Saving…" : "Continue"}</button>
      <p className="workspace-permission-note">Your project memberships determine access. This preference does not grant permissions.</p>
    </>}
  </section></main>;
}
