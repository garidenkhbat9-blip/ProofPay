# Safe project archive — owner approval required

Updated 2026-11-07. The reviewable implementation is [006_project_archive.sql](migrations/006_project_archive.sql), with an authenticated API and UI. **It has not been applied to the existing database. Archive is blocked there until the owner approves and an administrator deploys the required backend.** No live project or financial record was changed.

This replaces the earlier personal-folder archive/draft-removal design. The implemented proposal has one reversible project archive, no removal action and no permanent deletion. Its narrow eligibility prevents the existing archived status from interrupting shared work.

## Why archive was unavailable

Migration 001 permits member reads and updates to five project brief fields. It grants neither DELETE nor status updates, and migrations 001–005 contain no archive/reopen RPC. The previous UI intentionally disabled lifecycle actions. Enabling that button alone could not provide authorized persistence.

The existing `archived` status prevents new invitations, agreement creation/acceptance, handoffs/reviews and new invoice preparation. Using it on a project with a freelancer or obligations would strand a participant. Empty browser arrays cannot prove eligibility: payment history and webhooks are not fully loaded into the workspace.

## Rules submitted for approval

Only a verified user who is both `projects.created_by` and the current client member can archive or reopen. Perspective never grants this permission.

| Project state/history | Result |
| --- | --- |
| Unshared `draft`, including unsigned agreement versions, milestones and criteria | Archive allowed if all remaining checks pass. Those records stay intact. |
| Pending, unexpired invitation | Block; owner must revoke it first. |
| Revoked or expired invitation | Does not block. The invitation is retained, never deleted or changed by archive. |
| Freelancer membership, accepted invitation or `active` status | Block; shared-project archive is unsupported. |
| Any agreement acceptance, even on an older version | Block; accepted obligations are retained. |
| Any submission link or evidence submission | Block; delivery/review access must remain open. |
| Any payment or payment-history record, in any state | Block, including settled, cancelled, refunded, failed or unverified records. Financially historical projects cannot be archived under this proposal. |
| Missing required payment/history/webhook tables | Block with setup-required reason; absence never means no obligations. |
| Archived through this RPC, with matching latest audit event and no new blocker | Reopen to `draft`; keep all previous audit events. |
| Legacy archive without matching provenance | Block reopening; administrator review is required. |

Archiving sets `status='archived'`, records `archived_at` and increments `archive_revision`. The project remains readable to existing members and appears in All/Archived lists. It leaves active counts, actionable delivery totals and active planned-budget totals. Reopening clears `archived_at`, restores `draft` and restores active totals. No ongoing work is suspended: projects with ongoing work are ineligible.

## Additive SQL and migration comparison

006 adds two project columns, `project_archive_events`, one private guard and two public RPCs. It contains no DELETE statements, cascading relationships, replacement of existing RPCs or policy relaxation. Existing project rows receive only the new column defaults (`NULL`, `0`); no existing status, acceptance or payment is backfilled.

| Existing migration | Interaction with 006 |
| --- | --- |
| 001 foundation | Reuses `draft/active/archived`, verified-email and client-membership helpers, creator identity and project-first row locks. Existing RLS and brief-field UPDATE grants stay unchanged. |
| 002 agreements | Retains immutable drafts/milestones/criteria. Any approval blocks archive. Latest-version acceptance rules stay unchanged. |
| 003 handoffs | Any link/submission blocks archive. Evidence artifacts, signed storage access, review checks and revision history are untouched. |
| 004 PayPal Sandbox | Requires payment/history/webhook tables before enabling eligibility. Any related payment/history blocks archive. Merchant bindings, leases, invoice creation, reconciliation and webhook data are untouched. |
| 005 payment claim eligibility | Separate earlier proposal, retained unchanged. 006 introduces no payment-claim behavior. Do not silently apply 005 as part of archive approval. |

The SQL suite compiles 001–006 in a fresh in-memory PostgreSQL instance. That is not evidence of deployed-schema parity. Before approval/deployment, an administrator must compare the live migration ledger, columns, grants and any additional obligation tables with these files. The repository has no dispute table; if the live schema has one or gains one, its obligations must be included before enabling archive. 006 needs 001–004; the proposed 005 remains a separately reviewed payment change.

## Authorization, RLS, RPC and races

- `project_archive_events` uses restrictive project/actor foreign keys, member-only SELECT RLS and no authenticated INSERT/UPDATE/DELETE grants. Owner operations append history; they never edit or remove it. As with existing audit tables, privileged administrators retain their administrative capability.
- `get_project_archive_state(uuid)` returns eligibility only after verified owner/client checks. It is a hint, not authorization for a later write.
- `manage_project_archive(uuid,text,uuid,integer)` repeats identity and eligibility checks inside the transaction after `SELECT ... FOR UPDATE` on the project. This matches the lock order used by existing invitation, agreement and delivery routines. Invitation creation/acceptance that wins first blocks archive; archive that wins first makes the old workflow RPCs reject the archived project.
- Caller-supplied owner IDs and UI perspective are ignored. Both public functions use `SECURITY DEFINER SET search_path=''`, fully qualified references, PUBLIC/anon execute revocations and authenticated-only grants. The private guard is not callable by authenticated users.
- The expected revision rejects stale dialogs. Actor/request and project/revision uniqueness prevent duplicate events. Repeating an identical confirmed request returns current state without applying it again, including an old archive retry after a later reopen. Reusing a request for another action/project is rejected.
- `/api/projects/[id]/archive` validates the bearer with Auth, uses the caller's RLS context and repeats creator/client checks. No service-role key is used. Mutations validate action, UUID and integer revision, bound JSON size and reject cross-origin requests. RPC errors are mapped to public messages without leaking database diagnostics.
- The UI checks live eligibility, locks double clicks, keeps the request UUID on uncertain retries and refreshes only after confirmed writes. A refresh failure preserves the confirmed outcome and offers refresh rather than sending another mutation.

Sequential competing outcomes, stale revisions, retries and lost-response handling are covered locally. True two-connection PostgreSQL concurrency still requires staging verification; PGlite is not a multi-session concurrency proof.

## Data and rollback limitations

Agreements, milestones, criteria, members, invitations, submission links, evidence, reviews, invoices, payments, webhooks and their history are neither updated nor deleted. Only the project's archive fields/status and the new append-only events change. Existing finance workflows remain available on all projects they currently support because their history makes archive ineligible.

An application rollback must not remove these columns/events or replay old migrations. Existing clients still recognize `archived`. To disable writes, prepare a new reviewed forward-only migration revoking execute on the two new public RPCs; retain columns and history. To reopen projects, use the checked reopen operation where eligible or an individually reviewed administrative forward change. Do not mass-reset statuses or discard audit history.

## Approval boundary and local verification

Owner approval is required to execute 006 on the existing database. This implementation does not include automatic deployment, migration execution or a new service-role endpoint. Keep the UI explicitly unavailable if its RPC is absent.

Local SQL fixtures verify allowed archive/reopen, creator/member authorization, unrelated clients/freelancers/unverified/anonymous rejection, retained unsigned drafts and invitations, delivery/payment blockers, pending/expired invitations, latest agreement acceptance, missing payment schema, forbidden direct updates/deletes, stale requests and replay behavior. API and actual React component tests cover missing migration, safe messages, authorization, double clicks, lost responses, refresh failure and links. See [PROJECT-WORKFLOW-STATUS.md](PROJECT-WORKFLOW-STATUS.md) for executed results and remaining manual checks.
