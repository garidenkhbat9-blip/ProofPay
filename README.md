# ProofPay AI — Next.js edition

A native **Next.js 16.4.2 App Router + React 19.3.1 + TypeScript** migration of the deployed ProofPay workspace. Tailwind CSS 4 utilities are available; the existing Quiet Precision stylesheet is retained to preserve the approved white design. Fonts are served locally from npm packages.

This is editable React source, not a wrapper around the old `dist/app.js`. There is no embedded legacy script or `dangerouslySetInnerHTML` application renderer.

## Explore ProofPay

Public onboarding follows **Landing → `/explore` → Client/Freelancer → normal sign-in → `/dashboard`**. Sign in with your own Google or email account. The selected perspective follows the Google sign-in attempt and is saved only after identity verification. Returning users without an explicit choice use their saved preference. An existing session is shown explicitly before continuing or signing out to use another account. Perspective is a UI preference and never switches identity or grants permissions. `/judge-access` redirects to `/explore`; `/judge-workspace` redirects to the dashboard while preserving valid perspective intent. The normal dashboard supplies contextual next actions and role-specific empty states; there is no separate Judge Guide. Optional designated Sandbox projects appear in a collapsed dashboard section only when the account has matching membership. Missing designation configuration does not block ordinary projects or require judge setup. See [JUDGE-ACCESS.md](JUDGE-ACCESS.md) for architecture, changed files, setup and verification limitations.

The white Quiet Precision design is refined in `src/app/precision.css`, keeping the existing logo and local DM Sans/Manrope font families. Existing demo routes remain separate and simulated.

## Start in Antigravity (Windows)

1. Install Node.js **22.15 or newer** (Node 24 LTS recommended; API tests use Node's module hooks).
2. Extract this ZIP and open the `proofpay-next` folder in Antigravity.
3. In its terminal, run:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

4. Open **http://localhost:3000**.

For macOS/Linux, use `cp .env.example .env.local`. The ZIP omits `node_modules`, `.next`, and `.env.local`. These are created locally. `package-lock.json` is included; `npm ci` can replace `npm install` for an exact clean install.

## Existing Supabase project

`.env.example` contains the existing project URL and public publishable key:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://gsrnpbwsdwcpkjvomcwf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_eHuQtuSVofsJf2W2PD__ag_Gyip0dRs
```

These values are intended for the browser. All project access must be authorized by Supabase RLS and the checked SQL RPC functions.

**Do not rerun migrations on the existing database.** The owner reported applying migration 003 successfully. SQL files are included for reference and for initializing a new empty Supabase project (001 → 002 → 003). No live database migration was performed for this Next.js conversion. This archive does not contain database records or uploaded evidence.

In Supabase Authentication → URL Configuration, add the local development redirect URLs while keeping the existing production URLs:

- `http://localhost:3000/login`
- `http://localhost:3000/reset-password`

When deploying this Next.js project, add the equivalent HTTPS redirect URLs for that deployment, then set Site URL appropriately. This export does not change the existing private Sites deployment or its access policy. Links generated locally use localhost and are for local testing; share handoff links from a deployed origin for other users.

Google sign-in/sign-up now uses Supabase OAuth with a server PKCE callback and shared browser/server session cookies. See [GOOGLE-AUTH-SETUP.md](GOOGLE-AUTH-SETUP.md) for required provider setup and demo verification. Email/password confirmation remains enabled. Old localStorage sessions are not imported into cookie sessions: sign in once again after this upgrade. Production and localhost remain separate sessions.

## Features carried over

- Public homepage, Product, How it works and FAQ with the existing white visual design.
- Real App Router navigation, including direct links and browser back/forward navigation.
- One account with Client/Freelancer view switching; permissions remain project-specific.
- Project creation, filtered projects list, planned budgets and delivery status counts.
- Recipient-email invitations and accept/revoke actions. Invitations are in-app; no email delivery is connected.
- Versioned agreements, milestones, acceptance criteria, immutable version history and explicit two-party acceptance.
- Assigned-freelancer submission links, expiry/revocation, private file upload and URL evidence.
- Immutable submissions, revision history, client checklists, request changes, approval and signed file download.
- Account settings, submission/review inbox and activity derived from stored agreement/delivery records.
- A separate local demo at `/demo`. It uses a new browser-storage key and does not import or overwrite the old demo data. Sample data never enters the authenticated workspace.
- Compatibility redirects for old `/#project/...`, `/#handoff/...` and workspace hash links on this origin.

Approval records acceptance of work only. The Payments page does not simulate transactions.

PayPal Sandbox direct-merchant invoicing is implemented behind verified merchant configuration and additive migration 004. It is not enabled merely by adding credentials, and no real Sandbox end-to-end payment has been verified in this checkout. See [PAYPAL-INTEGRATION-REPORT.md](PAYPAL-INTEGRATION-REPORT.md) for ownership restrictions, setup, diagnostics, tests and deployment steps. Do not apply 001–003 again.

## Source map

| Location                       | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `src/app/`                     | App Router pages, layouts, global styling, loading/error boundaries |
| `src/app/(workspace)/`         | Authenticated workspace routes and shared shell                     |
| `src/components/marketing/`    | Native React public pages, preserving the earlier design            |
| `src/components/provider.tsx`  | Supabase session, account-scoped data loading, perspective, notices |
| `src/components/auth-form.tsx` | Login, signup, forgot/reset password                                |
| `src/components/projects.tsx`  | Projects, dashboard, invitations                                    |
| `src/components/agreement.tsx` | Agreement editor, immutable versions, acceptance                    |
| `src/components/delivery.tsx`  | Submission links, evidence uploads, revisions, client review        |
| `src/lib/types.ts`             | Domain entity types                                                 |
| `src/lib/domain.ts`            | Shared validation and status/permission selectors                   |
| `src/lib/supabase.ts`          | Browser SDK singleton from public environment variables             |
| `src/lib/cloud.ts`             | Cloud loading and checked RPC calls                                 |
| `migrations/`                  | Unchanged SQL foundation, agreements and delivery schema            |
| `tests/`                       | Domain and cloud-loading regression tests                           |

Routes include `/`, `/product`, `/how-it-works`, `/faq`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/demo`, `/dashboard`, `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/agreement`, `/projects/[id]/delivery`, `/handoff/[id]`, `/invitations`, `/agreements`, `/reviews`, `/payments`, `/activity`, `/settings`.

## Architecture and secrets

Authentication remains **browser-session based** to preserve the existing integration. Workspace records are fetched only after session initialization. The route guard is a UI guard, not database security: Supabase RLS and SECURITY DEFINER RPC checks remain authoritative. SSR cookie auth and server actions have not been introduced. Existing server API routes provide authenticated Gemini agreement drafting and PayPal Sandbox invoicing/webhook handling. The dashboard passes configured project IDs (not project records or credentials) to the client; the IDs do not grant access.

Never put `service_role`, Supabase secret keys, Browserless tokens, Gemini keys or PayPal secrets in a `NEXT_PUBLIC_*` variable, a React component, `public/`, or Git. No privileged secret is needed for the existing features. Future server integrations should keep their secrets in backend environment variables or Supabase Edge Function Secrets. Merely adding an API key will not implement those integrations.

## Not connected yet

- Gemini agreement drafting and client-triggered evidence text analysis are implemented. Live model lookup succeeded, but two bounded structured draft attempts failed (the second timed out); successful generation remains unverified. The evidence assistant reads notes and up to four private UTF-8 TXT/MD/CSV/JSON files, validates exact source quotes, and displays a temporary opinion bound to the agreement version and submission revision. It never approves or pays work. Unsupported files and websites remain `CANNOT_VERIFY`.
- Browserless/Playwright automated verification and queued verification workers.
- PayPal live payments, marketplace onboarding and arbitrary-freelancer payouts. Sandbox invoicing requires the separate payment setup described above.
- Automatic invitation emails or push notifications.
- Cleanup of abandoned private upload drafts.

Files are delivered through signed download URLs; there is no inline execution or file preview. An abandoned failed upload can leave private draft objects. Client code cannot overwrite/delete submitted artifacts.

## Validate and deploy

```sh
npm run typecheck
npm test
npm run test:sql
npm run build
npm start
```

The migration was checked with TypeScript, regression tests and a production build. Browser visual QA and a real two-account Supabase signup/upload/review run were not available in the build environment. Run the acceptance checklist below before using real projects.

For Vercel: import the project as Next.js, set the two public Supabase variables, and update Supabase auth redirect URLs for that domain. Other hosting must support a Next.js Node server (`npm run build` then `npm start`). This is not a static HTML upload and is not configured for `output: export`.

## Manual acceptance checklist

1. Sign in as client; create a project and invite another verified email.
2. In a second browser profile, sign in as that freelancer and accept the invitation.
3. Client saves a versioned agreement; both accounts review and accept it.
4. Client creates a delivery link. Freelancer opens it, adds a file/URL and submits.
5. Client requests changes with notes. Freelancer submits a new revision.
6. Client confirms each requirement and approves. Ensure approval alone creates no payment; only the configured merchant freelancer can initiate a separate authorized Sandbox invoice.
7. Verify an unrelated account cannot read that project or its files; changing workspace perspective must not grant access.
8. Check revoked/expired links prevent submission while already received evidence remains reviewable against the current agreement.
9. Test password reset and direct links in a signed-out browser.

## Current hackathon checkpoint

See [HACKATHON-FINAL-STATUS.md](HACKATHON-FINAL-STATUS.md) for executed results, external blockers and changed files; [HACKATHON-PROGRESS.md](HACKATHON-PROGRESS.md) is the resumable checkpoint. Migration `005_payment_claim_eligibility.sql` rechecks eligibility when an invoice lease is acquired and has passed disposable SQL tests. It has **not** been run against the existing database and requires administrator review and approval. Never rerun 001–004 on the existing database.

Continuation: migration 005 and the payment/evidence authorization fixtures now pass in disposable in-memory PostgreSQL via `npm run test:sql`. That command accepts no database URL and never connects to Supabase. Its minimal Auth/Storage tables test SQL policies and RPCs, not the hosted services or concurrent connections. Live application still requires administrator review/approval. See [OWNER-E2E-CHECKLIST.md](OWNER-E2E-CHECKLIST.md) for the remaining deployment and two-account steps. Gemini generation remains blocked: one 348-byte diagnostic request timed out before response headers; retries were stopped.

## Client experience checkpoint — 2026-11-06

Automatic per-user/per-perspective onboarding, clearer workspace surfaces and project browsing/actions are implemented. [CLIENT-EXPERIENCE-STATUS.md](CLIENT-EXPERIENCE-STATUS.md) records the historical 2026-11-06 checkpoint. Its disabled lifecycle UI has since been replaced by the implementation below. `npm run test:components` renders actual React components in local Chrome with isolated account/data adapters on Windows; this does not establish live authenticated behavior.

## Project workflow checkpoint — 2026-11-07

Agreement draft/invitation guidance, six data-driven workflow stages, compact role-specific empty states and a dashboard focused on the next action are implemented. Active counts and planned budgets exclude archives. Approval remains separate from payment.

The owner-only archive/reopen UI, authenticated API and additive [migration 006](migrations/006_project_archive.sql) are prepared and tested locally. **006 has not been applied to the existing database. Archive remains blocked pending owner approval and backend deployment.** It allows only unshared drafts and blocks pending invitations, accepted agreements, delivery history and all financial history. It never deletes records. Review the eligibility, RLS, RPC, migration comparison and rollback limitations in [PROJECT-LIFECYCLE-PROPOSAL.md](PROJECT-LIFECYCLE-PROPOSAL.md). Do not rerun existing migrations or silently deploy the separately proposed 005.

See [PROJECT-WORKFLOW-STATUS.md](PROJECT-WORKFLOW-STATUS.md) for the Mongolian completion report, exact executed checks, changed files, remaining live checks and client/freelancer QA steps. No live transaction, database migration, commit, push or deployment was performed.
