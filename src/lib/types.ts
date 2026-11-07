export type Role = "client" | "freelancer";
export type Category = "website" | "design" | "video";
export interface Project {
  id: string;
  created_by?: string;
  archived_at?: string | null;
  archive_revision?: number;
  title: string;
  description: string;
  work_category: Category;
  budget_amount: number;
  due_date: string | null;
  status: "draft" | "active" | "archived";
  currency: string;
  created_at: string;
}
export interface Member {
  project_id: string;
  user_id: string;
  role: Role;
}
export interface Profile {
  id: string;
  full_name: string;
  preferred_workspace?: Role;
}
export interface Invitation {
  id: string;
  project_id: string;
  project_title: string;
  invited_email: string;
  invited_by: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}
export interface Agreement {
  id: string;
  project_id: string;
  version: number;
  scope: string;
  change_note: string;
  created_at: string;
}
export interface Milestone {
  id: string;
  agreement_id: string;
  position: number;
  title: string;
  description: string;
  amount: number;
  due_date: string;
}
export interface Criterion {
  id: string;
  milestone_id: string;
  position: number;
  description: string;
}
export interface Approval {
  agreement_id: string;
  user_id: string;
  role: Role;
  approved_at: string;
}
export interface SubmissionLink {
  id: string;
  project_id: string;
  milestone_id: string;
  freelancer_id: string;
  instructions: string;
  active: boolean;
  expires_at: string;
  created_at: string;
}
export interface Submission {
  id: string;
  project_id: string;
  milestone_id: string;
  link_id: string;
  submitted_by: string;
  revision: number;
  status: "uploading" | "submitted" | "changes" | "approved";
  notes: string;
  created_at: string;
  submitted_at: string | null;
}
export interface Artifact {
  id: string;
  submission_id: string;
  kind: "file" | "url";
  label: string;
  storage_path: string | null;
  url: string | null;
  size_bytes: number | null;
}
export interface Review {
  id: string;
  submission_id: string;
  reviewed_by: string;
  decision: "approved" | "changes";
  note: string;
  confirmed_criteria: string[];
  created_at: string;
}
export interface CloudData {
  payments: WorkflowPayment[];
  paymentError: string;
  projects: Project[];
  members: Member[];
  profiles: Profile[];
  invitations: Invitation[];
  agreements: Agreement[];
  milestones: Milestone[];
  criteria: Criterion[];
  approvals: Approval[];
  links: SubmissionLink[];
  submissions: Submission[];
  artifacts: Artifact[];
  reviews: Review[];
  invitationError: string;
  agreementError: string;
  deliveryError: string;
}
export const emptyCloud = (): CloudData => ({
  payments: [],
  paymentError: "",
  projects: [],
  members: [],
  profiles: [],
  invitations: [],
  agreements: [],
  milestones: [],
  criteria: [],
  approvals: [],
  links: [],
  submissions: [],
  artifacts: [],
  reviews: [],
  invitationError: "",
  agreementError: "",
  deliveryError: "",
});
export interface MilestoneDraft {
  title: string;
  description: string;
  amount: number;
  due_date: string;
  criteria: string[];
}
export interface WorkflowPayment {
  id: string;
  project_id: string;
  milestone_id: string;
  agreement_id: string;
  submission_id: string;
  status: string;
  last_verified_at: string | null;
  reconciliation_status: string;
}
