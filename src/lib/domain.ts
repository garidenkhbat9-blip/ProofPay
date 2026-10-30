import type {
  CloudData,
  Invitation,
  MilestoneDraft,
  Submission,
  SubmissionLink,
} from "./types";
export const money = (n: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n));
export const categories = {
  website: "Website & app",
  design: "Graphic & UI design",
  video: "Video & content",
};
export const memberRole = (d: CloudData, projectId: string, userId?: string) =>
  d.members.find((m) => m.project_id === projectId && m.user_id === userId)
    ?.role;
export const latestAgreement = (d: CloudData, projectId: string) =>
  d.agreements
    .filter((a) => a.project_id === projectId)
    .sort((a, b) => b.version - a.version)[0];
export function currentDeliveries(d: CloudData, projectIds: string[]) {
  const agreements = new Set(
    projectIds.map((id) => latestAgreement(d, id)?.id),
  );
  const milestones = new Set(
    d.milestones.filter((m) => agreements.has(m.agreement_id)).map((m) => m.id),
  );
  const latest = new Map<string, Submission>();
  for (const submission of d.submissions) {
    if (!milestones.has(submission.milestone_id) || submission.status === "uploading") continue;
    const previous = latest.get(submission.milestone_id);
    if (!previous || previous.revision < submission.revision)
      latest.set(submission.milestone_id, submission);
  }
  return [...latest.values()];
}
export const agreementMilestones = (d: CloudData, id: string) =>
  d.milestones
    .filter((m) => m.agreement_id === id)
    .sort((a, b) => a.position - b.position);
export const milestoneCriteria = (d: CloudData, id: string) =>
  d.criteria
    .filter((c) => c.milestone_id === id)
    .sort((a, b) => a.position - b.position);
export const revisions = (d: CloudData, id: string) =>
  d.submissions
    .filter((s) => s.milestone_id === id)
    .sort((a, b) => b.revision - a.revision);
export const bothAccepted = (d: CloudData, id: string) =>
  ["client", "freelancer"].every((role) =>
    d.approvals.some((a) => a.agreement_id === id && a.role === role),
  );
export const invitationStatus = (i: Invitation, now = Date.now()) =>
  i.status === "pending" && Date.parse(i.expires_at) <= now
    ? "expired"
    : i.status;
export const deliveryStatus = (s?: Submission) =>
  s
    ? {
        uploading: "Draft",
        submitted: "Needs review",
        changes: "Changes requested",
        approved: "Approved",
      }[s.status]
    : "Awaiting delivery";
export function reviewable(d: CloudData, link: SubmissionLink) {
  const a = latestAgreement(d, link.project_id);
  const m = d.milestones.find((m) => m.id === link.milestone_id);
  return (
    !!a &&
    m?.agreement_id === a.id &&
    bothAccepted(d, a.id) &&
    d.projects.some((p) => p.id === link.project_id && p.status !== "archived")
  );
}
export const activeLink = (d: CloudData, l: SubmissionLink, now = Date.now()) =>
  l.active && Date.parse(l.expires_at) > now && reviewable(d, l);
export function safeUrl(value: string) {
  try {
    // Require an explicit web scheme; URL() also accepts malformed https:host.
    if (!/^https?:\/\//i.test(value.trim())) return null;
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function safeReturn(value: string | null) {
  return value &&
    /^\/(?:dashboard|projects(?:\/[\w/-]+)?|handoff\/[\w-]+|invitations|reviews|agreements|payments|activity|settings)(?:\?[^#]*)?$/.test(
      value,
    )
    ? value
    : "/dashboard";
}
export function validateEvidence(files: { size: number }[], urls: string[]) {
  if (!files.length && !urls.length)
    return "Add at least one file or work link.";
  if (files.length + urls.length > 10)
    return "Use up to 10 files and links combined.";
  if (files.some((f) => f.size > 20 * 1024 * 1024))
    return "Each file must be 20 MB or smaller.";
  if (urls.some((u) => !safeUrl(u) || safeUrl(u)!.length > 2048))
    return "Use valid HTTP or HTTPS links, up to 2,048 characters.";
  return "";
}
export function validateAgreement(
  scope: string,
  note: string,
  items: MilestoneDraft[],
  budget: number,
  revision: boolean,
) {
  if (!scope.trim() || scope.length > 10000)
    return "Enter the scope (up to 10,000 characters).";
  if (revision && !note.trim()) return "Describe what changed in this version.";
  if (note.length > 2000)
    return "Keep the change note within 2,000 characters.";
  if (items.length < 1 || items.length > 20) return "Add 1–20 milestones.";
  let cents = 0;
  for (const m of items) {
    if (!m.title.trim() || m.title.length > 120 || !m.due_date)
      return "Every milestone needs a title and due date.";
    if (m.description.length > 5000)
      return "Keep descriptions within 5,000 characters.";
    if (
      !Number.isFinite(m.amount) ||
      m.amount < 0 ||
      Math.abs(m.amount * 100 - Math.round(m.amount * 100)) > 0.00001
    )
      return "Use non-negative amounts with up to two decimal places.";
    cents += Math.round(m.amount * 100);
    if (
      !m.criteria.length ||
      m.criteria.length > 30 ||
      m.criteria.some((c) => !c.trim() || c.length > 1000)
    )
      return "Each milestone needs 1–30 criteria, up to 1,000 characters each.";
  }
  return cents === Math.round(Number(budget) * 100)
    ? ""
    : "Milestone amounts must add up to the project budget.";
}
// Keeps old links shared from the buildless application usable on this origin.
export function legacyPath(hash: string): string | null {
  const parts = hash.replace(/^#/, "").split("/");
  const id = parts[1];
  if (parts[0] === "project" && id && /^[\w-]+$/.test(id)) {
    const tab = ["agreement", "delivery"].includes(parts[2])
      ? "/" + parts[2]
      : "";
    return `/projects/${id}${tab}${parts[3] && /^[\w-]+$/.test(parts[3]) ? "?version=" + parts[3] : ""}`;
  }
  if (parts[0] === "handoff" && id && /^[\w-]+$/.test(id))
    return "/handoff/" + id;
  const map: Record<string, string> = {
    home: "/",
    dashboard: "/dashboard",
    projects: "/projects",
    reports: "/reviews",
    invitations: "/invitations",
    agreements: "/agreements",
    payments: "/payments",
    activity: "/activity",
    settings: "/settings",
    signin: "/login",
    signup: "/signup",
    forgot: "/forgot-password",
    recover: "/reset-password",
    demo: "/demo",
  };
  return map[parts[0]] ?? null;
}
