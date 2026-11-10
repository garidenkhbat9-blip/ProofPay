export const authOrigins = ["https://proof-pay-beta.vercel.app", "http://localhost:3000"];
export type WorkspaceIntent = "client" | "freelancer";
export function workspaceIntent(value: unknown): WorkspaceIntent | null {
  return value === "client" || value === "freelancer" ? value : null;
}
export function readOAuthIntent(raw: string | undefined, attempt: string, now = Date.now()): WorkspaceIntent | null {
  if (!raw) throw Error("Missing sign-in context. Please start Google sign-in again.");
  const value = JSON.parse(raw);
  if (value.attempt !== attempt || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + 600000) throw Error("Expired sign-in context");
  if (value.role !== null && !workspaceIntent(value.role)) throw Error("Invalid workspace intent");
  return workspaceIntent(value.role);
}
export function authOrigin(url: string) {
  const origin = new URL(url).origin;
  if (!authOrigins.includes(origin)) throw Error("Unrecognized application origin");
  return origin;
}
export function oauthDestination(preference: unknown) {
  return preference === "client" || preference === "freelancer"
    ? "/dashboard?perspective=" + preference : "/auth/workspace";
}
