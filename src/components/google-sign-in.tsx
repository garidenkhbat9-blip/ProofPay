"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import type { WorkspaceIntent } from "@/lib/google-auth";
export function GoogleAuthButton({ disabled = false, onBusy, intent }: { disabled?: boolean; onBusy: (busy: boolean) => void; intent?: WorkspaceIntent | null }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function start() {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const response = await fetch("/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: intent || null }), signal: AbortSignal.timeout(25000) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Google sign-in is unavailable.");
      const target = new URL(data.url);
      const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      if (target.origin !== supabase.origin || target.pathname !== "/auth/v1/authorize") throw Error("Invalid sign-in destination.");
      location.assign(target.href);
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "Sign-in could not start. Please try again later."); lock.current = false; setBusy(false); onBusy(false); }
  }
  return <div className="google-auth"><button type="button" className="google-auth-button widebutton" aria-busy={busy} disabled={busy || disabled} onClick={() => void start()}>
    <Image src="/google-g.svg" alt="" width={20} height={20} aria-hidden="true" />
    <span>{busy ? "Opening Google…" : "Continue with Google"}</span></button>
    {error && <p className="google-auth-error" role="alert">{error}</p>}</div>;
}
