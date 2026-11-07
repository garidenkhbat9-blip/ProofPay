let until = 0;
export function authCooldown() { return Math.max(0, Math.ceil((until - Date.now()) / 1000)); }
export function deferAuth(seconds = 60) { until = Math.max(until, Date.now() + seconds * 1000); }
export function observeAuthResponse(response: Response) {
  if (response.status !== 429) return;
  const raw = response.headers.get("retry-after");
  const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : 60;
  deferAuth(Number.isFinite(seconds) && seconds > 0 ? seconds : 60);
}
