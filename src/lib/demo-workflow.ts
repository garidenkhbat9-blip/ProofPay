export const demoStages = [
  { title: "Create project", actor: "Client" },
  { title: "AI agreement", actor: "Both parties" },
  { title: "Submit work", actor: "Freelancer" },
  { title: "AI verification", actor: "ProofPay AI" },
  { title: "Client review", actor: "Client" },
  { title: "Payment", actor: "Client" },
] as const;

export const demoMilestones = [
  {
    title: "Responsive website",
    amount: 1200,
    due: "Day 7",
    deliverables:
      "Home, pricing and contact pages · responsive navigation · source code",
    criteria: [
      "All three pages included in the submitted website.",
      "Navigation works at 390px, 768px and 1440px.",
      "Source code and desktop/mobile screenshots are provided.",
      "Visual design matches the agreed layouts.",
    ],
  },
  {
    title: "Content & forms",
    amount: 800,
    due: "Day 10",
    deliverables:
      "Final copy · contact form · validation and confirmation states",
    criteria: [
      "Approved copy replaces all placeholder content.",
      "Contact form validates email and required fields.",
      "Successful and failed submissions have clear feedback.",
    ],
  },
  {
    title: "Launch handoff",
    amount: 400,
    due: "Day 14",
    deliverables: "Deployment guide · metadata · access and ownership handoff",
    criteria: [
      "Page titles, descriptions and social previews are configured.",
      "Deployment and rollback instructions are documented.",
      "Client receives source ownership and an access checklist.",
    ],
  },
] as const;

export interface DemoEvidenceFile {
  name: string;
  size: number;
  sample: boolean;
}
export interface DemoSubmission {
  revision: number;
  url: string;
  notes: string;
  files: DemoEvidenceFile[];
}
export interface DemoWorkflow {
  stage: number;
  project: { name: string; brief: string } | null;
  agreed: boolean;
  submissions: DemoSubmission[];
  verifiedRevision: number | null;
  decision: "pending" | "changes" | "approved";
  reviewNote: string;
  paid: boolean;
  activity: { title: string; actor: string; detail: string }[];
}
export const initialDemoWorkflow: DemoWorkflow = {
  stage: 0,
  project: null,
  agreed: false,
  submissions: [],
  verifiedRevision: null,
  decision: "pending",
  reviewNote: "",
  paid: false,
  activity: [],
};
export type DemoAction =
  | { type: "navigate"; stage: number }
  | { type: "create"; name: string; brief: string }
  | { type: "agree" }
  | { type: "submit"; url: string; notes: string; files: DemoEvidenceFile[] }
  | { type: "verify" }
  | { type: "changes"; note: string }
  | { type: "approve"; reviewed: boolean; acknowledged: boolean; note: string }
  | { type: "pay" }
  | { type: "restart" };

export function demoUnlockedStage(state: DemoWorkflow) {
  if (state.decision === "approved") return 5;
  if (state.verifiedRevision !== null) return 4;
  if (state.submissions.length && state.decision !== "changes") return 3;
  if (state.agreed) return 2;
  return state.project ? 1 : 0;
}
export function demoReducer(
  state: DemoWorkflow,
  action: DemoAction,
): DemoWorkflow {
  const record = (
    patch: Partial<DemoWorkflow>,
    title: string,
    actor: string,
    detail: string,
  ) => ({
    ...state,
    ...patch,
    activity: [...state.activity, { title, actor, detail }],
  });
  const latest = state.submissions.at(-1);
  switch (action.type) {
    case "restart":
      return initialDemoWorkflow;
    case "navigate":
      return Number.isInteger(action.stage) &&
        action.stage >= 0 &&
        action.stage <= demoUnlockedStage(state)
        ? { ...state, stage: action.stage }
        : state;
    case "create":
      if (state.project || !action.name.trim() || !action.brief.trim())
        return state;
      return record(
        {
          project: { name: action.name.trim(), brief: action.brief.trim() },
          stage: 1,
        },
        "Project created",
        "Maya · Client",
        "$2,400 USD · 14-day delivery",
      );
    case "agree":
      if (!state.project || state.agreed) return state;
      return record(
        { agreed: true, stage: 2 },
        "Agreement v1 accepted",
        "Maya + Alex",
        "Three milestones and their acceptance criteria agreed by both parties.",
      );
    case "submit": {
      if (
        !state.agreed ||
        (latest && state.decision !== "changes") ||
        !action.notes.trim() ||
        !action.files.length
      )
        return state;
      try {
        if (!["https:", "http:"].includes(new URL(action.url).protocol))
          return state;
      } catch {
        return state;
      }
      const submission = {
        revision: state.submissions.length + 1,
        url: action.url.trim(),
        notes: action.notes.trim(),
        files: action.files.map((file) => ({ ...file })),
      };
      return record(
        {
          submissions: [...state.submissions, submission],
          verifiedRevision: null,
          decision: "pending",
          stage: 3,
        },
        `Revision ${submission.revision} submitted`,
        "Alex · Freelancer",
        `${submission.files.length} evidence files · Responsive website`,
      );
    }
    case "verify":
      if (
        !latest ||
        state.decision !== "pending" ||
        state.verifiedRevision === latest.revision
      )
        return state;
      return record(
        { verifiedRevision: latest.revision },
        `Sample report v${latest.revision} generated`,
        "ProofPay AI · simulated",
        "Scripted checks only. Client review is still required.",
      );
    case "changes":
      if (
        !latest ||
        state.verifiedRevision !== latest.revision ||
        state.decision !== "pending" ||
        !action.note.trim()
      )
        return state;
      return record(
        {
          decision: "changes",
          reviewNote: action.note.trim(),
          verifiedRevision: null,
          stage: 2,
        },
        "Changes requested",
        "Maya · Client",
        action.note.trim(),
      );
    case "approve":
      if (
        !latest ||
        state.verifiedRevision !== latest.revision ||
        state.decision !== "pending" ||
        !action.reviewed ||
        !action.acknowledged
      )
        return state;
      return record(
        { decision: "approved", reviewNote: action.note.trim(), stage: 5 },
        "Milestone approved",
        "Maya · Client",
        "$1,200 is payment-ready. Approval does not send money.",
      );
    case "pay":
      if (state.decision !== "approved" || state.paid) return state;
      return record(
        { paid: true },
        "Simulated payment completed",
        "Maya · Client",
        "$1,200 USD · Demo PayPal receipt · No money moved.",
      );
  }
}
