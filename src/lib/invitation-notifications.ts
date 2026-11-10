import type { Invitation } from "./types";

type Recipient = { id: string; email?: string; email_confirmed_at?: string } | null;

export function receivedInvitations(items: Invitation[], user: Recipient) {
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !user.email_confirmed_at || !email) return [];
  return items.filter(i => i.invited_email.trim().toLowerCase() === email);
}

export function pendingInvitations(items: Invitation[], user: Recipient, now = Date.now()) {
  return receivedInvitations(items, user).filter(i =>
    i.status === "pending" && Date.parse(i.expires_at) > now,
  );
}

export const invitationCountLabel = (count: number) => count > 9 ? "9+" : String(count);
