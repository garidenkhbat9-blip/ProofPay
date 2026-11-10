"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "./provider";
import { invitationCountLabel, pendingInvitations } from "@/lib/invitation-notifications";

export function useInvitationNotifications() {
  const { data, user, loaded, error } = useWorkspace();
  const [, tick] = useState(0);
  const items = pendingInvitations(data.invitations, user);
  const nextExpiry = Math.min(...items.map(i => Date.parse(i.expires_at)));
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => tick(n => n + 1), Math.min(2147483647, Math.max(0, nextExpiry - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [nextExpiry]);
  return { items, count: loaded && !data.invitationError ? items.length : null, stale: !!error };
}

export function InvitationBadge() {
  const { count, stale } = useInvitationNotifications();
  if (!count) return null;
  const label = `${count} pending project invitation${count === 1 ? "" : "s"}${stale ? " (last known status)" : ""}`;
  return <span className="invitation-count" role="img" aria-label={label} title={label}>{invitationCountLabel(count)}</span>;
}

export function InvitationNotice() {
  const { count, stale } = useInvitationNotifications();
  if (!count) return null;
  return <div className="invitation-summary">
    <p>You have {count} pending project invitation{count === 1 ? "" : "s"}.{stale && <small>Last known status. Reconnect or refresh to check for updates.</small>}</p>
    <Link href="/invitations">Review invitation{count === 1 ? "" : "s"}<span aria-hidden="true"> →</span></Link>
  </div>;
}
