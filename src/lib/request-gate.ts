export function createRequestGate(cooldownMs: number, maxEntries = 1000) {
  const entries = new Map<string, { busy: boolean; nextAllowed: number }>();
  return {
    claim(key: string, now = Date.now()): (() => void) | null {
      for (const [id, entry] of entries)
        if (!entry.busy && entry.nextAllowed <= now) entries.delete(id);
      const entry = entries.get(key);
      if (
        entry?.busy ||
        (entry && entry.nextAllowed > now) ||
        entries.size >= maxEntries
      )
        return null;
      const current = { busy: true, nextAllowed: now + cooldownMs };
      entries.set(key, current);
      return () => {
        current.busy = false;
      };
    },
  };
}
