import type { CloudData, Role } from "./types";
import { judgeRole } from "./judge-access";

export const perspectiveKey = (userId: string) => `proofpay-perspective:${userId}`;

// Used only when there is no explicit entry, saved choice or auth preference.
// A sole project role avoids the legacy profiles table's default Client value
// sending an established freelancer to an empty view. Never grants membership.
export function recordPerspective(data: CloudData, userId: string): Role {
  const roles = new Set(data.members.filter((m) => m.user_id === userId && data.projects.some((p) => p.id === m.project_id)).map((m) => m.role));
  if (roles.size === 1) return [...roles][0];
  return judgeRole(data.profiles.find((p) => p.id === userId)?.preferred_workspace) || "client";
}

export function accountPerspective(
  stored: string | null,
  preferred: unknown,
  requested?: unknown,
): Role {
  // Explicit, validated entry intent overrides a stored presentation preference only.
  if (requested === "client" || requested === "freelancer") return requested;
  if (stored === "client" || stored === "freelancer") return stored;
  return preferred === "freelancer" ? "freelancer" : "client";
}

/** Coalesce reads, but always queue a fresh read after a concurrent mutation. */
export function createRefreshQueue(
  work: () => Promise<void>,
  now = Date.now,
  cooldown = 5000,
) {
  let pending: Promise<void> | null = null;
  let again = false;
  let disposed = false;
  let lastStarted = -Infinity;
  return {
    request(force = true): Promise<void> {
      if (disposed) return Promise.resolve();
      if (pending) {
        if (force) again = true;
        return pending;
      }
      if (!force && now() - lastStarted < cooldown) return Promise.resolve();
      pending = Promise.resolve().then(async () => {
        try {
          do {
            again = false;
            if (disposed) break;
            lastStarted = now();
            await work();
          } while (again && !disposed);
        } finally {
          pending = null;
        }
      });
      return pending;
    },
    dispose() { disposed = true; again = false; },
  };
}
