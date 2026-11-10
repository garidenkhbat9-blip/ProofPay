import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Role } from "./types";

export type TourStatus = "completed" | "skipped";
export interface TourRecord { status: TourStatus; version: 1; recorded_at: string }
export interface TourStep { target?: string; title: string; description: string }
export const tourPreferenceKey = (role: Role) => `proofpay_tour_${role}_v1`;
export const tourStorageKey = (userId: string, role: Role) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}:tour:${userId}:${role}:v1`;

export function tourRecord(value: unknown): TourRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<TourRecord>;
  return record.version === 1 && (record.status === "completed" || record.status === "skipped") &&
    typeof record.recorded_at === "string" && Number.isFinite(Date.parse(record.recorded_at))
    ? record as TourRecord : null;
}

export function tourSteps(role: Role): TourStep[] {
  return [
    { target: "overview", title: "Your workspace at a glance", description: role === "client"
      ? "Overview brings together your projects, review requests and next actions. Planned budgets are estimates, not money received."
      : "Overview brings together your jobs, delivery updates and next actions. Your permissions come from each project's membership." },
    { target: "projects", title: role === "client" ? "All your projects" : "Your assigned jobs", description: role === "client"
      ? "Open Projects to find your briefs, freelancer and invitation status. Open any project to see its records and next action."
      : "My jobs lists the projects you have joined as a freelancer. Open a job to see the agreed scope and delivery requirements." },
    ...(role === "client" ? [{ target: "new-project", title: "Start with a clear brief", description: "New project lets you name the work, describe the brief and set a planned budget. You can invite your freelancer from the project team section." }] : []),
    { target: "invitations", title: role === "client" ? "Keep track of invitations" : "Join your client's project", description: role === "client"
      ? "Invite a freelancer from a project's Team section, then track or revoke the invitation here. Invitations appear inside ProofPay; no email is sent."
      : "Your client invites your verified account email. Review the invitation here before accepting; joining does not accept an agreement or authorize payment." },
    { target: "workflow", title: "From agreement to payment", description: role === "client"
      ? "Both parties accept an agreement. Review delivered evidence against its criteria, then record your decision. Approval accepts work; Payments separately shows recorded PayPal Sandbox status."
      : "Accept the agreement, submit evidence through your assigned delivery link, then follow the client's review. Approval and payment are separate; Earnings shows recorded PayPal Sandbox status." },
    { title: "Welcome to ProofPay", description: role === "client"
      ? "You're ready to create a project or continue an existing one. Each project will guide you to the next action."
      : "You're ready to review invitations and continue your work. Each job will guide you to the next action." },
  ];
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
function localRecord(storage: Storage | undefined, userId: string, role: Role) {
  try { return tourRecord(JSON.parse(storage?.getItem(tourStorageKey(userId, role)) || "null")); } catch { return null; }
}
function remember(storage: Storage | undefined, userId: string, role: Role, record: TourRecord) {
  try { storage?.setItem(tourStorageKey(userId, role), JSON.stringify(record)); return !!storage; } catch { return false; }
}
async function identity(client: SupabaseClient, expectedId: string) {
  const { data: session, error } = await client.auth.getSession();
  if (error || session.session?.user.id !== expectedId) throw Error("Your account changed. Please refresh.");
  const token = session.session.access_token;
  const verified = await client.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== expectedId) throw Error("Your preferences could not be loaded.");
  return { user: verified.data.user, token };
}

async function persist(token: string, userId: string, role: Role, record: TourRecord) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { [tourPreferenceKey(role)]: record } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Your tour preference could not be saved.");
  const user = await response.json() as User;
  if (user.id !== userId || !tourRecord(user.user_metadata?.[tourPreferenceKey(role)]))
    throw Error("Your tour preference could not be confirmed.");
}

export async function readTourPreference(client: SupabaseClient, userId: string, role: Role, storage?: Storage): Promise<"show" | "dismissed" | "unavailable"> {
  const local = localRecord(storage, userId, role);
  try {
    const { user, token } = await identity(client, userId);
    const remote = tourRecord(user.user_metadata?.[tourPreferenceKey(role)]);
    if (remote) { remember(storage, userId, role, remote); return "dismissed"; }
    if (local) { await persist(token, userId, role, local); return "dismissed"; }
    return "show";
  } catch {
    return local ? "dismissed" : "unavailable";
  }
}

export async function saveTourPreference(client: SupabaseClient, userId: string, role: Role, status: TourStatus, storage?: Storage) {
  const record: TourRecord = { status, version: 1, recorded_at: new Date().toISOString() };
  const local = remember(storage, userId, role, record);
  try {
    const { token } = await identity(client, userId);
    await persist(token, userId, role, record);
    return { remote: true, local };
  } catch {
    return { remote: false, local };
  }
}

export interface Rect { left: number; top: number; width: number; height: number }
export function tourPlacement(target: Rect | null, panel: { width: number; height: number }, viewport: { width: number; height: number; top?: number; left?: number }) {
  const pad = 12, gap = 16, x = viewport.left || 0, y = viewport.top || 0;
  const clampX = (value: number) => Math.max(x + pad, Math.min(value, x + viewport.width - panel.width - pad));
  const clampY = (value: number) => Math.max(y + pad, Math.min(value, y + viewport.height - panel.height - pad));
  if (!target) return { left: clampX(x + (viewport.width - panel.width) / 2), top: clampY(y + (viewport.height - panel.height) / 2) };
  if (target.left + target.width + gap + panel.width <= x + viewport.width - pad)
    return { left: clampX(target.left + target.width + gap), top: clampY(target.top) };
  const below = target.top + target.height + gap;
  return { left: clampX(target.left), top: clampY(below + panel.height <= y + viewport.height - pad ? below : target.top - panel.height - gap) };
}
