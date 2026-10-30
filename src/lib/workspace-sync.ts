import type { Role } from "./types";

export const perspectiveKey = (userId: string) => `proofpay-perspective:${userId}`;

export function accountPerspective(
  stored: string | null,
  preferred: unknown,
): Role {
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
