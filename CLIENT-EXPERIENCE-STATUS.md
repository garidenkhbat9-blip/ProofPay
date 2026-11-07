# Client experience completion checkpoint — 2026-11-06

Historical checkpoint. The archive proposal and disabled-action status below are superseded by the 2026-11-07 [project workflow implementation report](PROJECT-WORKFLOW-STATUS.md) and the updated [migration proposal](PROJECT-LIFECYCLE-PROPOSAL.md). Migration 006 and its API/UI now exist locally; deployment still requires owner approval.

The onboarding and visual refinement work is complete locally. Project browsing and contextual actions are implemented. Delete/Archive mutations remain unavailable pending the separately reviewed lifecycle proposal. This report covers the resumed client-experience task; earlier Gemini/payment changes already present in the working tree are not new changes from this continuation.

## Result

- The dashboard automatically opens a role-specific tour after authentication, workspace loading and preference lookup. Client steps cover Overview, Projects, New project, Invitations and the agreement/review/payment workflow; freelancer steps omit client creation.
- Finish/Skip records are scoped to the authenticated user and perspective, stored in existing Supabase Auth metadata with an account-scoped local fallback. Unknown preference reads do not show a first-visit flash. Offline saves retry on a later read/online event; both-storage failure is reported without claiming persistence.
- The native modal, moving spotlight, progress indicator, Back/Next/Skip/Finish, missing-target fallback and focus restoration operate on actual React interface elements. There is no permanent Quick tour button.
- Workspace tokens distinguish neutral backgrounds, white cards, sage surfaces and forest-green actions. Project lists show planned budget, freelancer, invitation status and next action. Detail screens have responsive workflow steps, clearer metadata and a contextual action menu. Membership remains authoritative regardless of perspective.
- Delete/Archive options explain retention and remain disabled. No endpoint or client-side array check grants a lifecycle mutation. Revoked invitations remain revoked; work approval remains separate from payment.

## Fixes completed during this continuation

Visual inspection found the tour popover clipped by the classic scrollbar at 320px. A browser regression test reproduced the failure before the fix. Popover sizing and positioning now use the dialog's available space and the visual viewport. The tour also waits for an open mobile navigation dialog to close, avoiding competing focus traps. Keyboard checks exercise real Tab and Escape input.

## Relevant files

| Area | Files |
| --- | --- |
| Automatic tour and preferences | `src/components/dashboard-tour.tsx`, `src/lib/guided-tour.ts` |
| Dashboard, project list/detail, actions | `src/components/projects.tsx`, `src/components/project-actions.tsx`, `src/lib/project-management.ts` |
| Styling and shared presentation | `src/app/workspace.css`, `src/app/layout.tsx`, `src/components/ui.tsx`, `src/components/workspace-onboarding.tsx`, `src/lib/workspace-onboarding.ts` |
| Authorization coverage | `src/lib/project-authorization.ts`, `tests/project-authorization.test.ts`, `tests/sql/project-retention.sql` |
| Tour/project regression coverage | `tests/guided-tour.test.ts`, `tests/project-management.test.ts`, `tests/browser/client-components.test.mjs`, `tests/browser/client-experience.js` |
| Local test runners | `package.json`, `scripts/preview-client-experience.ps1`, `scripts/test-browser-fallback.ps1`, `scripts/test-sql.mjs` |
| Proposal and checkpoints | `PROJECT-LIFECYCLE-PROPOSAL.md`, `README.md`, `HACKATHON-PROGRESS.md`, this report |

Existing workspace-shell and marketing edits were preserved. This continuation changed only tour geometry/launch gating, its stylesheet/browser tests, and the completion documentation.

## Executed verification

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 126 tests, zero failures/skips, including Chromium component coverage |
| `npm run test:components` | PASS: 28 desktop, 29 mobile and 29 narrow-screen fixture assertions; 11 viewport scenarios in total, plus Tab containment, Escape-to-Skip persistence and focus restoration |
| `npm run test:sql` | PASS: migrations 001–005 in fresh in-memory PostgreSQL, payment/evidence/project-retention fixtures and rollback |
| `npm run build` | PASS: production compilation, TypeScript and all 24 static pages |
| `node scripts/http-smoke.mjs` | PASS: 19 production HTTP checks and both Explore links; temporary server stopped |
| `git diff --check` | PASS; Git reports existing LF/CRLF conversion notices |
| Lint | No lint script/configuration is provided; not claimed as run |

The initial 320px browser regression failed as expected, then passed after the fix. Desktop dashboard/detail and mobile/narrow/landscape tour screenshots were inspected. Local artifacts are under `.validation/client-experience/`; rerun `npm run test:components` to regenerate them. The component builder requires Windows/PowerShell and Chrome, and explicitly skips on unsupported environments. Auth, data and routing adapters are isolated fixtures; these are real component renders, not a live authenticated Next.js workflow.

## Approval and remaining work

The checked-in schema grants no authenticated project DELETE or status-update permission and contains no safe lifecycle RPC. Using the existing `archived` status for shared projects would block collaboration. The forward-only [migration 006 proposal](PROJECT-LIFECYCLE-PROPOSAL.md) therefore separates personal workspace archive from reversible removal of an empty draft, with server ownership checks, locks, audit events and retained-history guards. It is a proposal only: migration 006 and lifecycle mutation handlers have not been implemented or applied. Authorized delete/archive success, restoration and concurrent mutation behavior are consequently not claimed as tested.

Live Supabase Auth preference persistence across real accounts/browsers, two-account RLS/upload/review testing, deployed-schema comparison and browser QA of the authenticated production application remain pending. SQL fixtures use local platform stubs and cannot establish hosted Auth/Storage behavior or multi-connection concurrency.

No existing database migration was rerun, no production data was changed or deleted, and no payment, commit, push or deployment was performed. Existing Sites hosting is unchanged.
