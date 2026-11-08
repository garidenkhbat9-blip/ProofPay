# Phase 5 — inspection findings and approval-required proposals

## Recorded before implementation — 2026-11-08

Sources inspected: Phase 1–4 implementation report; project-workspace/domain selectors; types/cloud loader; invitation notifications, ProjectWorkspace, AgreementPage/Editor, HandoffPage/ReviewForm, ActivityPage; migrations 001–006; PayPal model and webhook code. No production records or credentials were inspected or modified.

- Invitations: persisted created_at/expires_at/status, recipient matched by verified email. Existing invite/accept/revoke RPCs lock project then invitation. Accept is idempotent. Invite refuses an existing freelancer and revokes prior pending invitations. No email is sent (001 explicitly states this). UI invitation counts derive from these records, not a general notification channel.
- Agreement waiting: current version created_at and per-role approved_at. Latest version must be accepted by both participants. A new version requires expected prior ID and change_note; it creates NEW milestone IDs. No typed extension request, rejection, counterproposal or obligation carry-forward exists.
- Delivery: milestone due_date, both acceptance timestamps, submission-link created_at, submitted_at, immutable revisions. Link expiry/revocation is a delivery-access issue, not freelancer nonresponse.
- Review: latest submitted_at; no contractual review-response SLA. Changes requested/approval have submission_reviews.created_at. No separate revision deadline. Passing the original delivery date cannot make a client review or revision automatically overdue.
- Payment: matching agreement/milestone/submission snapshots and verified provider state. Approval is not payment; current cloud payment projection has no invoice due date. Do not derive payment lateness from milestone delivery dates.
- Archive/reopen: proposed 006 only permits unshared drafts, blocks accepted contracts, delivery and payment history. Its availability is checked by existing API; it is not a cancellation workflow and deployment remains owner-controlled.
- No generic reminder API, notification/outbox table, dispatch receipt, durable rate-limit store, cancellation, dispute or reassignment lifecycle exists. Auth confirmation resend is not project communication. No supported email-provider integration was found in server code or public configuration templates; private environment values were not read.

Safe without schema changes: read-only waiting/age/deadline presentation, deterministic action priority, project-scoped persisted event timeline, links to existing checked invitation/agreement/delivery/review/payment flows, explicit channel-unavailable guidance. No new reminder success, counter, event or send action may be fabricated.

## Proposal A — authenticated in-app reminders (NOT activated)

Owner approval is required for schema, policy, retention and deployment. Prefer in-app first; email requires a separately approved provider and delivery policy.

Minimal additive records:

- `project_reminders`: id, project_id, milestone_id nullable, agreement_id, submission_id/revision nullable, invitation_id nullable, actor_id, recipient_id, reason enum, context fingerprint, idempotency UUID, created_at, next_allowed_at. Unique(actor_id, idempotency UUID); duplicate key with different context must fail.
- `project_notifications`: reminder_id UNIQUE, recipient_id, created_at, read_at; insert atomically with reminder. Recipient-only SELECT and narrowly checked mark-read RPC. Sender can read their dispatch receipt, not recipient private information. Notification content derives from saved context, not arbitrary supplied text or addresses.
- If email is later approved: transactional outbox + attempts/leases/provider message ID + bounded retries + explicit queued/dispatched/failed outcomes. Never equate queued/recorded with delivered. Worker must recheck current eligibility before dispatch and cancel obsolete requests. Provider acceptance is not inbox delivery.

Checked RPC contract: input project/milestone/context/idempotency only, NEVER recipient/email. Verify Auth email and actual membership; lock project, resolve current outstanding obligation and opposite verified participant server-side, verify exact current agreement/revision and active project. A pending invite whose recipient has no verified account is ineligible for in-app reminder; do not disclose account existence. Return generic channel-unavailable result. Already accepted/reviewed/submitted actions are ineligible.

Conservative proposed policy (owner configurable server-side): one reminder per project+recipient per 24 hours across all milestone reasons; max three per recipient per rolling seven days across projects; sender max five/day across projects. Use DB UTC time, locked per-recipient quota row or transaction advisory lock PLUS project lock in a documented global order; all check/insert/quota/notification writes in one transaction. Idempotent replay returns original receipt without consuming quota. Distinct concurrent keys still serialize. No in-memory-only limiter. Cooldown responses carry actual next_allowed_at; render locally without network countdown polling. Roll back quota on failed atomic insert; external retry uses same outbox entry, never a new reminder.

Required preactivation tests: unrelated/unverified actors, client-supplied recipient injection, cross-project/milestone context, accepted invitation, review-completed-before-lock, updated agreement/revision, archived project, same-key replay/mismatch, concurrent distinct keys, project+recipient and cross-project recipient limits, failed insert rollback, dispatch failure/retry, stale outbox, recipient-only RLS, no approval/invoice/payment effects. Hosted two-account delivery tests remain required after approval. These tests cannot be claimed passed before the backend exists.

## Proposal B — deadline extensions (NOT activated)

Existing client-created agreement version + both-party fresh acceptance remains available, but is NOT a targeted extension system: publishing immediately supersedes the current version, creates new milestone IDs, and blocks work until both accept. Do not silently edit accepted dates or offer one-click extension on an in-flight contract.

Typed amendment proposal should retain immutable original agreement/milestone/date, proposed date, proposer, reason, expected context/version, status proposed/accepted/rejected/withdrawn/superseded, both-party decision records and UTC timestamps. Either party may propose; neither may accept on behalf of the other. Rejection preserves existing terms. Concurrent acceptance and supersession must be serialized. Define how accepted/paid/invoiced milestones retain their IDs and obligations BEFORE implementing. Pending proposal alone never alters a deadline. UI must compare old/proposed dates and identify proposer. No migration drafted/executed until these policies are reviewed.

## Proposal C — cancellation, dispute and reassignment (NOT activated)

- Mutual cancellation: proposed → accepted by both / rejected / withdrawn; no silence-as-consent. Each participant can decline without forfeiting evidence or payment claims. Must snapshot outstanding deliveries, accepted work, issued invoices, verified paid/refunded amounts and disputes under lock. Record both decisions and reviewed settlement terms. A cancellation record does not refund, void invoices, erase debts or remove evidence. Financial operations retain existing separate authorizations.
- Dispute: define scope, decision authority, access, response windows, appeal and retention first. No operational dispute process currently exists; do not claim a case was filed. All evidence remains immutable, with least-privilege reviewed access. No automatic approval or transfer of funds.
- Reassignment: only future specifically identified work after valid amendment/cancellation authorization, with informed participant notices and new assignee consent. Preserve former participant access to historical terms/evidence/financial records as policy allows. Never rewrite historical freelancer/merchant bindings or transfer existing invoices to a new user. Existing invite RPC deliberately rejects a staffed project.
- Archive is not cancellation. No escrow is represented: this project uses direct-merchant PayPal Sandbox invoicing. Inactivity alone changes no contractual or financial state.

## Approval boundary

These are design proposals only, not deployed SQL or running jobs. No new tables, RPCs, notification sends, cron jobs, migrations, cancellation, reassignment or payment paths are activated in Phase 5. Working waiting/recovery UI will explicitly distinguish current supported flows from these unavailable capabilities.
