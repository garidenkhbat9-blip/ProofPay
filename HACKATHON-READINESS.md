# ProofPay — Hackathon readiness audit

Audit date: 2026-11-04. Scope: existing Next.js edition, current working tree, and read-only inspection of the Supabase project selected by local configuration. No claim is made that Vercel uses the same configuration or database.

**Verdict: not yet a complete, independently judge-testable submission.** The application compiles and its 87 regression tests pass. Much of the real workflow is implemented. The immediate blocker is the actual demonstration setup: Judge Client has no project membership, no separate Judge Freelancer identity was found, and the configured merchant account currently has only a client membership. There are no saved agreements, milestones, evidence submissions, reviews, invoices, payment-history entries or webhook events in the inspected database. A complete provider-backed payment and live Gemini draft remain unverified.

No application, styling, authentication, payment, environment, migration or database changes were made. No provider payment operation, invoice creation/send, signup, sign-in, upload, email, commit, push or deployment was performed. This report is the only intended new file. Existing Sites hosting was not touched.

Evidence labels:

- **VERIFIED**: actually executed during this audit, with the scope stated.
- **IMPLEMENTED**: supported by source inspection, not a claim of successful integration.
- **UNVERIFIED**: available code or configuration without the necessary execution evidence.
- **BLOCKED**: a required path cannot currently be demonstrated with the inspected setup or available access.
- **NOT IMPLEMENTED**: no implementation found in the inspected source.

Priorities: P0 blocks a real demonstration; P1 materially improves demonstration quality; P2 is optional polish or expansion. Complexity includes verification/setup effort where no code change is needed. Every unresolved item is assigned an ID below; matrices refer to those IDs.

## 1. VERIFIED AND WORKING

### Repository and execution baseline

| Check | Observed result |
| --- | --- |
| Branch / latest commit | `main`, `b2055a1`, message `judge`, committed 2026-10-31 14:29:19 +08:00 |
| Initial working tree | Only `src/components/workspace-shell.tsx` modified: 28 removed lines, removing the sidebar workspace description and perspective selector. Preserved. |
| Architecture | Native Next.js App Router, React components and TypeScript. Manifest versions: Next 16.4.2, React/React DOM 19.3.1, TypeScript 7.0.2, Supabase JS 2.118.0; Node engine requirement >=22. |
| `npm run typecheck` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS: 87 tests, 0 failed, 0 skipped |
| `npm run build` | PASS: Next.js 16.4.2 production build; all listed public/workspace/API routes compiled |
| `git diff --check` | PASS before report creation; only an existing LF/CRLF warning |
| Runtime availability | The approved npm execution environment ran all required checks. Direct `node` was unavailable in the restricted shell; an approved external execution successfully ran the installed SDK read checks. This is not a project build failure. |
| Deployment configuration | `next.config.ts` sets `poweredByHeader: false` and `reactStrictMode: true`. Node server scripts exist; no static export. No local Vercel project link/configuration or canonical deployed URL was found. |

Read: `AGENTS.md`, `README.md`, `JUDGE-ACCESS.md`, `PAYPAL-INTEGRATION-REPORT.md`, `WORKFLOW-PILOT.md`, relevant components, API routes, libraries, migrations 001–004 and all regression-test files. Installed Next.js route-handler/deployment guides were also consulted. The requested existing design was preserved.

### Local HTTP smoke checks

A production server was started on `127.0.0.1:3100` for read-only/unauthenticated checks and stopped after the audit.

- `/`, `/explore`, both role-specific login destinations and `/demo` returned HTTP 200. Explore HTML contained both correct encoded login links.
- `/dashboard`, `/invitations`, `/payments`, and project/detail/agreement/delivery paths using a synthetic UUID returned HTTP 200 with the session-loading guard. These responses do **not** establish that a project exists or that authenticated navigation works.
- `/judge-access` returned 307 to `/explore`; legacy Client/Freelancer entries returned 307 to the corresponding dashboard perspective; invalid perspective returned 307 to `/dashboard`.
- Unauthenticated `/api/payments` GET and agreement-draft/invoice/refresh POST requests returned 401. The POST probes had no bearer token and were rejected before database/provider operations. No PayPal API was called.
- These are HTTP/SSR checks, not browser hydration, visual, keyboard or login-session tests.

### Read-only Supabase findings

Admin Auth reads, bounded table SELECTs, Storage bucket metadata and the REST schema were inspected without mutation. The installed Supabase SDK separately confirmed HTTP 200 for admin reads of merchant bindings and payments. The dataset was below the 1,000-row query bounds.

| Observed object | Actual state |
| --- | --- |
| Auth identities | 2 accounts, both email-confirmed and both with a recorded prior sign-in |
| Judge Client | Identified by account/profile labels; has **zero project memberships** |
| Dedicated Judge Freelancer | **No separate identity identified** by Auth email/name/metadata or profile labels in the returned accounts |
| Configured merchant identity | The other existing account; not labeled as a Judge account. `PAYPAL_FREELANCER_USER_ID` resolves to this account. |
| Account preferences | Both stored profiles prefer `client`; neither has an Auth metadata perspective override |
| Merchant binding | 1 active binding with `verified_at` populated. Freelancer ID, merchant ID/email and SHA-256 client-ID fingerprint match local configuration. This proves stored/configuration consistency, not independent PayPal ownership verification. |
| Projects / memberships | 1 draft `design` project, with 1 membership: the configured merchant account is its **client**. There is no freelancer member. |
| Invitations | 1 revoked invitation; no usable pending invitation |
| Agreements / milestones / criteria / acceptances | 0 / 0 / 0 / 0 |
| Submission links / submissions / artifacts / reviews | 0 / 0 / 0 / 0 |
| Payments / history / webhook events | 0 / 0 / 0 |
| Evidence bucket | `proofpay-evidence` exists, `public=false`, 20,971,520-byte file limit |
| Relevant database API surface | Foundation/agreement/delivery tables and payment tables are readable administratively. All 14 inspected workflow/payment RPC names appear in the REST schema. Exact SQL definitions, deployed policies and migration-ledger equivalence were not retrieved. |

Anonymous SDK SELECT probes against `projects`, `project_members`, `evidence_artifacts`, `payments`, `paypal_merchant_bindings` and `paypal_webhook_events` returned HTTP 401 / PostgreSQL `42501`. This verifies anonymous denial for those requests. Admin reads bypass RLS and cannot establish member-versus-outsider isolation.

An initial PowerShell probe returned 401 because it used the default browser-like User-Agent; a server User-Agent and then the actual SDK succeeded. **The earlier 401 is not an unresolved credential failure.** Supabase documents browser User-Agent rejection for secret keys. [Supabase API-key security](https://supabase.com/docs/guides/getting-started/api-keys)

### Environment presence and secret handling

Only names, presence, validation outcomes and equality comparisons were exposed; no secret values, tokens, merchant email or account UUIDs are included here.

| Variable | Local `.env.local` state |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Present |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Present |
| `SUPABASE_SECRET_KEY` | Present; SDK admin reads succeeded |
| `GEMINI_API_KEY` | Present; generation not exercised |
| `GEMINI_MODEL` | Absent; source default applies |
| `BROWSERLESS_API_TOKEN` | Present; no source consumer/integration found |
| `PAYPAL_ENV` | Present; Sandbox-mode validation passed |
| `PAYPAL_CLIENT_ID` | Present; fingerprint matches stored binding |
| `PAYPAL_CLIENT_SECRET` | Present; provider authentication not attempted |
| `PAYPAL_WEBHOOK_ID` | Present; registration/delivery not verified |
| `PAYPAL_FREELANCER_USER_ID` | Present; UUID-shape check passed; maps to existing non-Judge account |
| `PAYPAL_MERCHANT_ID` | Present; shape and stored-binding comparison passed |
| `PAYPAL_MERCHANT_EMAIL` | Present; shape and stored-binding comparison passed |
| `PROOFPAY_JUDGE_PROJECT_IDS` | Absent; optional dashboard designation only, not an access grant |

No matching integration-variable overrides were reported from the inspected shell environment. Vercel variables and any provider-side settings remain unverified. Example files are tracked; `.env.local` is ignored. Exact-value scans for the four private provider keys across 151 selected tracked source/documentation/assets and built client-static files found zero matches. This is a bounded current-file scan, not a full Git-history or deployment-secret audit. `src/lib/server/*` uses the server-only boundary; browser Supabase configuration contains only public variables.

## 2. IMPLEMENTED BUT NOT VERIFIED

### Real workflow, step by step

All authorization descriptions below are source-level unless explicitly marked as executed. Historical Auth sign-in timestamps and existing project/invitation rows are evidence of stored activity, not proof of a successful UI acceptance run.

| Step | Implementation and authorization | Automated coverage | Real-account/integration evidence and remaining gate |
| --- | --- | --- | --- |
| 1. Client authenticates | `auth-form.tsx`, `provider.tsx`, `supabase.ts`: email/password, confirmation, recovery, session persistence and local sign-out. API routes verify bearer tokens with `auth.getUser`; workspace guard is client-side. | Auth validation, safe return paths, existing-session acknowledgment and account-scoped defaults; no actual login test. | Both accounts have historical sign-ins; no login/recovery/browser transition executed here. R3, R4. |
| 2. Client creates project | `projects.tsx` → `create_project`, migration 001. Verified-email check and automatic client membership in one RPC. | Domain/workflow/cloud mocks; no direct database create integration test. | One project exists, owned by the merchant account as client; Judge Client owns none. R1, R3. |
| 3. Client invites freelancer | `invite_freelancer`: actual project client, verified email, no self-invite, one freelancer slot, prior pending invite revoked. In-app delivery only. | Invitation status/expiry/selectors; RPC error mock, not live authorization. | Only invitation is revoked. No current judge invitation. R1, R3; email absence N3. |
| 4. Freelancer accepts | `accept_project_invitation`: verified recipient email, project/invitation locks, expiry/revocation, membership uniqueness, idempotent accepted retry. | Domain/onboarding/next-action cases; no live acceptance test. | No freelancer membership exists. R1–R3. |
| 5. Agreement/milestones created | `agreement.tsx`, migration 002: client-only immutable new version, expected-version check, USD total equals project budget. Manual editor and optional Gemini website draft. | Agreement validation and AI parser/prompt cases; no persisted agreement test. | All agreement tables empty. Existing project category is `design`, so the Gemini draft UI/route is unavailable for it. R1, R3, R6. |
| 6. Both accept | `approve_agreement_version`: real member role, confirmed email, latest version, freelancer must exist, separate role acceptance records. | Both-role/current-version domain tests. | No acceptance rows. R3. |
| 7. Freelancer submits evidence | `delivery.tsx`, migration 003: client creates link after acceptance; assigned freelancer starts draft, uploads private files/URLs, finalizes immutable revision. | Input validation, expiry/revocation, superseded agreement, lost-finalization-response retry cases. | Bucket exists; no artifact/submission/link rows. Stored object contents were not enumerated. No live upload/download or isolation test. R3, R7. |
| 8. Client reviews/approves | `review_evidence`: actual client, latest submitted revision, accepted current agreement, every real criterion confirmed, immutable review. Approval does not pay. | Review prerequisites/next actions/approval-payment separation. | No reviews. R3. |
| 9. Freelancer requests payment | Payments UI → invoice route → `prepare_paypal_payment`. The assigned, merchant-bound freelancer creates and sends an invoice after approval; no separate request-payment ledger is needed in this design. | Payment snapshot/state/workflow mocks; SQL script exists but was not executed. | No eligible project/milestone; seller identity/membership mismatch in current setup. R1, R2, R5. |
| 10. Client pays Sandbox invoice | Client-only hosted Sandbox link displayed for a verified `UNPAID` invoice; application does not capture funds itself. | URL allowlist and status mapping unit tests only. | No invoice/payment exists. Checkout, buyer credentials and provider permissions unverified; financial actions intentionally not performed. R5. |
| 11. Verify/record payment | Signed-webhook verification or authorized refresh → authoritative invoice GET → strict matching → service-only state/history RPCs. | Mock gateway, signature result, duplicate/out-of-order event, lease/recovery and transaction-evidence cases. | Zero webhook/payment/history records. Real signature delivery, real provider response compatibility and reconciliation remain unverified. R5, R7. |

### PayPal critical audit

| Concern | Source evidence / finding | Remaining verification |
| --- | --- | --- |
| Sandbox server configuration | `payments/config.ts` hard-codes `api-m.sandbox.paypal.com`, rejects non-Sandbox mode and missing settings. Local shape checks passed. | Valid app credentials, Invoicing permissions and Vercel configuration: R4, R5. |
| Merchant ownership | `server/payments.ts:64` checks active verified binding and app fingerprint; payment snapshots are checked against that same configuration. Stored binding matches locally. | External merchant ownership is not proved by the database's `verified_at` flag. Organizer must confirm the owning Sandbox Business account. R2, R5. |
| Freelancer restriction | Invoice route requires project freelancer membership; SQL binds that freelancer to the merchant, and server validates against configured freelancer ID. Changing perspective cannot satisfy these checks. | Current merchant has only client membership, while Judge Client has none. No separate Judge Freelancer found. R1, R2. |
| Approval prerequisite | Migration 004 `prepare_paypal_payment` checks latest agreement, both exact members' acceptance, latest approved submission, client review, positive amount, USD and verified payer email. | Actual SQL definition/grants and full account test: R3, R7. |
| Create/send | `gateway.ts` implements OAuth, create draft, send, get and search; `workflow.ts` GETs/validates before sending. | No provider calls made; no invoice created. R5. |
| Checkout | `model.ts` allows only HTTPS `www.sandbox.paypal.com/invoice/...`, rejects credentials/ports/other hosts; UI limits pay action to stored payer. | Real invoice must return a compatible recipient URL. R5. |
| Verification | Exact invoice identity/number, operation reference, merchant email, payer, amount and currency required. `PAID` additionally needs zero due balance and unique PayPal-origin transactions totaling the snapshot. Manual/external payment is not treated as paid. | Capture a genuine Sandbox GET response and prove all fields match; the mock fixtures are not provider evidence. R5. |
| Webhooks | `api/paypal/webhook/route.ts`, `payments/webhook.ts`: verifies through PayPal's signature endpoint before durable event storage; checks certificate URL shape without downloading it; reconciles by invoice GET. | Same-app webhook registration, public HTTPS delivery, invalid signature, duplicate and out-of-order delivery tests. R5. |
| Duplicate prevention | Unique milestone/provider invoice/operation IDs; durable attempted-create marker; database lease; ambiguous create recovers by number and never blindly creates again. | Mock concurrency passes; real SQL/concurrent-worker behavior unverified. R7. |
| Reconciliation/history | Service-only finish/fail functions, stale timestamp protection, paid/refunded history preservation; visible-page stored-history polling and manual provider refresh. | No actual history exists. No cron reconciliation worker. R5; optional worker N4. |
| Errors | Bounded provider input, timeouts, sanitized diagnostics/debug IDs, no raw provider errors/tokens returned. | Deployed failures and UI recovery after a genuine interrupted operation remain unverified. R5, R8. |

The invoice's funds belong to the configured merchant. ProofPay does not collect money and then pay arbitrary freelancers. **A newly created or separately labeled Judge Freelancer cannot issue an invoice unless it is the actual configured merchant identity with the matching verified binding.** Currently the database contains no such separate Judge Freelancer. Selecting Freelancer on Explore changes presentation only. The owner must choose a safe demonstration seller identity; this audit did not change the binding.

Endpoint shape was compared with primary PayPal references: [create draft invoice](https://developer.paypal.com/api/invoicing/v2/invoices-create), [show invoice details](https://developer.paypal.com/api/invoicing/v2/invoices-get), and [verify webhook signature](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post). These references do not establish merchant access or a successful payment.

### AI capability classification

| Category | Actual implementation |
| --- | --- |
| A. Real agreement drafting | Implemented server-side in `server/gemini-agreement.ts` and `/api/projects/[id]/agreement-draft`. Verified project client only, active website project, bounded scope/request/response, 45-second provider timeout, structured output parsing, non-thought text extraction and `STOP` completion requirement. |
| Response integrity | `agreement-draft.ts` validates scope/title/criteria and takes money/date from project data, not the model. Prompt treats brief text as untrusted. Output is an editable proposal; applying it does not save or accept an agreement. Saving uses the normal versioned RPC. |
| Loading/error/display | `agreement-draft-builder.tsx` shows generation/loading/error states, previews the model/draft, disables stale-scope application and requires explicit use/save. No fallback fake success output was found. Model provenance is displayed during drafting; no separate persisted AI-run/provenance ledger was found. |
| B. Real AI evidence analysis | **Not implemented.** Actual file contents, submitted URLs and evidence notes are not sent to Gemini by the real delivery workflow. |
| C. Simulated AI | Guided `/demo` uses scripted local reports and a local PayPal simulation. `demo-workflow.ts` and `demo-walkthrough.tsx` label simulation; data is kept separate from the authenticated workspace. |
| D. Automated verification | **Not implemented.** No Browserless client, Playwright/Lighthouse runner, verification queue or persisted real verification report schema was found. `delivery.tsx:680` explicitly displays `CANNOT_VERIFY` and says no website/file-content checks ran. |

`GEMINI_MODEL` is absent locally, so the source default is `gemini-3.8-flash`. Google currently documents that model and structured-output support; model availability for this key, quota and this deployed request remain unverified. It would be incorrect to declare the default nonexistent based on older model knowledge. [Google model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash?authuser=3), [Generate Content structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

**Smallest high-impact additional AI improvement, recommendation only (N1):** an authenticated evidence-review assistant for one immutable submission revision. Give Gemini the accepted criteria, actual submission notes and bounded contents of supported uploaded text files; return criterion-linked quotations, gaps and questions. Unsupported files and unvisited URLs remain `CANNOT_VERIFY`; do not infer website behavior from names or links. Persist a new append-only report with submission/agreement IDs, content hashes, model/version and timestamp through a reviewed additive migration. The client still makes every approval decision. Start with text evidence to avoid Browserless networking/SSRF scope. First verify the existing agreement draft; adding another feature is not needed to establish that real Gemini drafting works.

## 3. BROKEN OR BLOCKED

These are current configuration/data/verification blockers, not evidence that every underlying feature needs rebuilding.

| ID / priority | Relevant file/component | Problem and user impact | Exact verification or fix | Owner manual action? | Complexity |
| --- | --- | --- | --- | --- | --- |
| R1 / P0 | `projects.tsx`, `agreement.tsx`, migrations 001–003; actual project/member/invitation records | Judge Client has no accessible project; only existing project is a draft design project owned by the merchant as client, without a freelancer. Invitation is revoked. A judge cannot enter a prepared real workflow, and this project cannot demonstrate website AI drafting. | In an explicitly approved test setup, Judge Client creates a **website** project, invites the intended merchant-bound seller's verified email, and that seller accepts. Save a real milestone/criteria and genuinely progress through acceptance/evidence/review. Preserve existing records; do not fabricate completed progress. | Yes: authorize test records, actors and real work evidence. | Small |
| R2 / P0 | `payments/config.ts`, `server/payments.ts:64`, migration 004, `/explore` | No dedicated Judge Freelancer was identified; the existing non-Judge account is the configured merchant. New arbitrary judge accounts cannot invoice. Current bound account is a client in the only project. | Confirm seller identity privately against `PAYPAL_FREELANCER_USER_ID`, active binding and owning Sandbox app. Smallest route is an owner-controlled demonstration using the current bound account as freelancer in a new Judge Client project. For independent judge seller access, decide whether that account is safe to provide; otherwise a dedicated test seller and independently verified binding require a separately authorized setup. Never impersonate or automatically rebind. | Yes: identity/access and merchant ownership decision. | Small for current merchant; Medium for separately approved dedicated seller setup |
| R3 / P0 | `auth-form.tsx`, `provider.tsx`, `projects.tsx`, `agreement.tsx`, `delivery.tsx`, migrations 001–003 | No live two-account workflow, third-account denial or file-access acceptance run. Existing rows do not prove authorization and immutable revisions work end to end. | Use two separate browser profiles plus an unrelated third account in an approved test environment. Execute all non-payment steps, revision 2, superseded agreement, expired/revoked link and signed-download checks. Record actual denials and immutable old versions. | Yes: test accounts/environment and permission for test writes. | Medium |
| R4 / P0 | `next.config.ts`, `supabase.ts`, API routes, Vercel/Supabase dashboards | Deployment URL, deployed commit/env, Auth redirect allowlist and accessible webhook destination were not verified. Local success does not prove judge access. | Identify canonical HTTPS Next.js deployment and deployed SHA; privately compare required variables, Node runtime and function durations. Verify role-specific login, signup confirmation/reset return URLs and public webhook reachability. Retain Sites deployment. | Yes: deployment dashboard/access/URL and any configuration changes. | Small |
| R5 / P0 | PayPal API routes, `payments/gateway.ts`, `model.ts`, `workflow.ts`, `components/payments.tsx` | No Sandbox OAuth/invoice/checkout/payment/webhook/reconciliation execution; payment tables are empty. Cannot claim a real PayPal demonstration. | After R1–R4/R7, get explicit authorization for one controlled Sandbox invoice/payment. Validate amount, USD, recipient and merchant; pay with a separate Sandbox Personal buyer; confirm through a genuinely verified webhook and/or authoritative refresh. Capture one payment row/history, transaction proof and no duplicate invoice after reload/retry. See exact sequence in section 7. | Yes: financial-action approval and Sandbox seller/buyer/dashboard access. | Medium |
| R6 / P0 | `server/gemini-agreement.ts`, agreement-draft route/builder | Real AI capability exists only as unverified code; the only stored project's design category excludes drafting. No provider response was obtained. | On the authorized website project, have its client generate, inspect, apply and manually save one genuine Gemini draft. Confirm money/date preservation and neither acceptance nor verification is inferred. Check timeout/429/invalid-response feedback. Fix only demonstrated provider incompatibilities. | Yes: test account, approved brief/provider use and deployed configuration access if needed. | Small |
| R7 / P0 | migrations 001–004, `tests/payments-authorization.sql`, private storage | Live table/RPC presence is established, but deployed SQL definitions, grants/RLS and lease/snapshot behavior have not been validated. Unit mocks cannot prove financial isolation. | Review migration ledger, actual policies/grants and definitions read-only; compare with source. Run SQL authorization/lease tests on a disposable/local database only, plus authenticated member/outsider tests. If drift exists, review a new additive correction; never rerun existing migrations blindly. | Yes: disposable database and admin policy access. | Medium |
| R8 / P1 | `workspace-shell.tsx`, all auth/project/payment pages | Desktop/mobile browser QA and hydrated session transitions unavailable. No browser/`node_repl` tool exposed, and no installed Playwright package found. HTTP 200 is insufficient. | Exercise 1440px and 375px layouts, login/sign-out/account acknowledgment, invitations, agreement modal, evidence upload/download, payment actions, focus trap/Escape and back/refresh. Do not change approved design without an observed defect. | Yes: browser-capable environment or manual QA. | Small |
| R9 / P1 | Existing uncommitted `workspace-shell.tsx` diff; `projects.tsx:158,382`; `account.tsx` | Sidebar perspective switch was removed. The remaining other-role dashboard action appears only when the current view has zero projects. Mixed-role users with projects in both views lose that in-workspace switch, and `/projects/new` says “Switch to Client view” without a control. | Owner reviews the existing diff. If intentional, provide a minimal functional route/control to change perspective or correct the dead-end guidance in a later change. Verify both-role account navigation. Current workaround: go to `/explore`, choose the view, explicitly continue with the same account. No auth-role changes needed. | Yes: decide intent of existing edit; later implementation can be local. | Small |
| R10 / P1 | Marketing `home.tsx`, `product.tsx`, `how.tsx`, `faq.tsx`; README, JUDGE-ACCESS, PayPal report, WORKFLOW-PILOT | Claims are inconsistent: some public sections say PayPal is planned/unconnected while Explore says Sandbox invoicing; older reports say configuration/runtime missing. Judge documentation still describes a removed sidebar switch. Confusing scope weakens credibility. | Update English copy/docs only after setup checks: distinguish implemented Sandbox, verified runs, unimplemented evidence analysis and separate simulation. Preserve visual layout. See claim comparison below. | No for a later documentation fix; owner should confirm final demo scope. | Small |

### Judge experience and documentation comparison

- Landing → Explore → role-specific normal login → dashboard is implemented and its signed-out links/redirects passed HTTP checks. There is no insecure one-click login.
- Existing sessions at role-specific login show the current email and require explicit continuation or sign-out. Choosing a perspective does not authenticate a dedicated account. Names/emails remain visible in workspace; Account has sign-out.
- Judges still need securely supplied account access. Current database setup gives Judge Client no project and no invitation to act on. The site cannot infer or supply the missing dedicated seller identity.
- The optional Prepared Sandbox projects panel requires designation **and** actual membership. Local designation is absent. That absence alone is not a blocker and must not be “fixed” by exposing arbitrary projects.
- `PAYPAL-INTEGRATION-REPORT.md` says webhook/merchant variables and runtime validation were missing at the time. Locally, those variables are now present, a matching active binding exists, payment tables/RPC names exist, and the full test/build run passes. Those older statements are historical, not current blockers. External PayPal execution is still unverified.
- `WORKFLOW-PILOT.md` describes Gemini/PayPal as upcoming and suggests client-authorized invoicing. Current code has Gemini drafting and uses **freelancer-issued** direct-merchant invoices. Its historical 25-test result is superseded by this audit's 87 tests.
- README's blanket “no privileged secret needed for existing features” is inaccurate for the current PayPal backend: `paymentAdmin()` requires `SUPABASE_SECRET_KEY`. Its migration setup summary and “payment stays unconnected” checklist are older than migration 004.
- README/JUDGE-ACCESS describe sidebar perspective switching; the current uncommitted diff removes it. This report audits the working tree, not just HEAD.

## 4. NOT IMPLEMENTED

These are explicit scope gaps. Only N1 is recommended as the next AI addition; none was implemented during this audit.

| ID / priority | Relevant file/component | Problem and user impact | Exact next verification/fix | Owner manual action? | Complexity |
| --- | --- | --- | --- | --- | --- |
| N1 / P1 | `delivery.tsx:680`, future authenticated AI report endpoint/storage | No real evidence analysis or persisted AI evidence report. Gemini agreement drafting cannot be described as evidence verification. | Implement the narrowly scoped evidence-review assistant described in section 2 only after audit approval; use actual content, citations, immutable reports and human approval. Until then keep `CANNOT_VERIFY`. | Yes: approve scope, provider data handling and any additive schema change. | Medium |
| N2 / P2 | No Browserless/Playwright/Lighthouse client, worker or check-result schema | No automated website checks despite a local Browserless token. Cannot prove deployed page behavior from a URL. | If later needed, add supported measurable checks with public-target validation, redirect/DNS protections, timeouts, captured artifacts and revision-bound results. Keep unsupported checks unavailable. | Yes: provider setup and approved migration/work scope. | Large |
| N3 / P2 | Migration 001, Invitations UI | No invitation email/push delivery; recipient may wait for an email that will never arrive. | For this demonstration, explicitly direct the recipient to Invitations. Add email integration only if needed later. | No code/setup required for in-app workflow; organizer must communicate access. | Small for demo guidance; Medium for email integration |
| N4 / P2 | `payments/webhook.ts`, payment refresh route | No scheduled reconciliation/failed-webhook worker. Recovery relies on provider retries, merchant resend and member refresh. | Exercise existing refresh/resend during R5. Add a lease-aware worker only if unattended recovery becomes a requirement. | Yes for worker scheduling/provider administration if added. | Medium |
| N5 / P2 | Single-merchant config and migration 004 | Arbitrary-freelancer payouts, marketplace seller onboarding, escrow and live payments are absent. | Keep direct-merchant Sandbox scope explicit. A marketplace requires separate approved onboarding/payment architecture; it is not a credential switch. Not required for a single-seller Sandbox demo. | Yes: separate product/provider approval. | Large |
| N6 / P2 | PayPal UI/gateway | In-app refund/cancel initiation absent; application only reconciles provider outcomes. | Use the Sandbox merchant dashboard in an explicitly approved recovery test. Implement new financial actions only if later required. | Yes for any refund/cancel test. | Small to verify existing reconciliation; Medium to add actions |

## 5. SECURITY RISKS

Positive source findings: membership is derived from real Supabase identity, not perspective or mutable Auth metadata; SECURITY DEFINER RPCs use an empty search path and explicit actor/membership checks; client mutation grants are restricted; accepted terms/submitted artifacts are immutable through browser privileges; financial snapshots have an immutability trigger; signed downloads expire after 60 seconds; uploads disable overwrite; human approval is separate from payment. No authorization bypass was established by this audit. These findings do not replace deployed policy tests (R3/R7).

| ID / priority | Relevant file/component | Risk and user impact | Exact verification or fix | Owner manual action? | Complexity |
| --- | --- | --- | --- | --- | --- |
| S1 / P1 | `request-gate.ts`, agreement-draft route, webhook/invoice routes | AI cooldown is process-local; webhook verification and invoice authentication can cause provider requests without a shared request-rate budget. Multiple instances or abusive callers could consume quota. Payment leases prevent duplicate financial operations, not all provider traffic. | Before broad public judging, configure provider quotas and deployment rate limits; test bounded behavior across instances. Add shared account/project throttling if hosting controls are insufficient. Do not rely on the in-memory gate as a global limit. | Yes: hosting/provider controls. | Medium |
| S2 / P2 | Migration 003 `can_upload_evidence`, upload loop | File-size limit exists, but draft objects can accumulate and no cleanup/quota process was found. Failed upload retries can leave unused private objects; no malware/content scanner exists. | Keep downloads explicit and inspect evidence manually. For longer use, add per-user/draft limits and a retention job that excludes all finalized artifacts. Verify no submitted artifact can be deleted/overwritten. | Yes for retention policy and a cleanup job; no cleanup performed now. | Medium |
| S3 / P2 | `cloud.ts:53`, UI error rendering | Generic cloud failures display raw database error messages, unlike the sanitized payment/AI handlers. This can reveal schema/constraint detail and give inconsistent recovery guidance. No secret leak was observed. | Map unexpected database errors to safe user messages and private diagnostic IDs; retain intended validation messages. Test unavailable schema, permission and network failure displays. | No for a later local fix. | Small |
| S4 / P2 | `cloud.ts` `loadCloud` | Twelve unpaginated `select('*')` reads rely on backend row caps. At larger data volumes, incomplete snapshots may mislead counts, latest-version selection or workflow guidance. No truncation occurred in the tiny inspected dataset. | Add pagination or project-scoped loading with explicit completeness handling; test more than the configured row limit. No need to rebuild the current one-project demo. | No for a later code fix; staging fixtures need approval. | Medium |

R3/R7 are the P0 security verification gates: anonymous denial was tested, but authenticated outsider access, field grants, submitted-file isolation and SQL concurrency remain unverified. No SQL test was run against the existing database. The supplied SQL test creates fixtures even though it rolls them back; it belongs only on a disposable database.

## 6. REQUIRED MANUAL SETUP

This is an owner checklist, not a record of actions performed. Priorities, files, impacts and complexity are in the referenced issue rows.

| Required action | Issue | Completion evidence |
| --- | --- | --- |
| Decide the real seller identity and whether it can safely be used by judges. Keep the existing verified binding unless a separately reviewed change is authorized. | R2 / P0 | Private identity comparison and independently confirmed Sandbox Business ownership; no role/perspective substitution |
| Authorize a test project and actual two-party workflow. Use Judge Client as client and the selected bound merchant as freelancer; use website category for Gemini. | R1, R3 / P0 | Both actual memberships, usable invitation acceptance, real agreement/evidence/review history |
| Supply/identify canonical Vercel URL, deployed SHA and dashboard configuration. | R4 / P0 | Deployed revision/env parity and reachable HTTPS app/API; auth confirmation/recovery returns to intended origin |
| Confirm same-app Sandbox webhook registration and a separate Sandbox Personal buyer. | R5 / P0 | Correct endpoint/events/subscription and authorized seller/buyer test access; credentials shared only privately |
| Authorize one Sandbox invoice/payment after review. No real/live money. | R5 / P0 | Actual provider transaction, verified webhook or GET confirmation, matching immutable snapshot/history |
| Provide a disposable database and read-only policy/definition access. Do not rerun 001–004 on the current project. | R7 / P0 | Policy/grant comparison, SQL test output and real member/outsider results |
| Authorize a real Gemini draft using a suitable brief. | R6 / P0 | Actual provider-produced editable draft in the deployed workflow |
| Run browser QA or provide a browser-enabled environment. | R8 / P1 | Desktop/mobile screenshots and actual interaction results, including account changes |

`PROOFPAY_JUDGE_PROJECT_IDS` is optional presentation configuration. Setting it does not create projects, grant membership or solve the seller mismatch. The current missing designation does not need to be made a prerequisite.

## 7. EXACT NEXT STEPS

1. **Resolve R2 before any payment work.** Privately identify the configured existing merchant and choose the authorized demonstration seller. If keeping this merchant, use that account as freelancer in a new project; its current client role in a different project does not prevent that. If independent judge access requires another identity, obtain a separate reviewed merchant setup decision. Do not silently change `PAYPAL_FREELANCER_USER_ID`.
2. **Confirm R4 deployment parity.** Record the judge URL and deployed commit, compare variable presence/configuration privately, confirm Node/server routes, and inspect Auth login/reset destinations. No deploy is authorized by this report.
3. **Close R7 in a disposable environment.** Inspect existing migration ledger/policies first. Run `tests/payments-authorization.sql` only on disposable/local Supabase, along with real authenticated member/outsider storage and project checks. Schema presence alone does not justify rerunning migration 004.
4. **Prepare R1/R3 with genuine interactions after write approval.** Judge Client creates a website project with a positive USD milestone; invite the selected merchant-bound freelancer; accept from the correct account. Draft/save the agreement and have both parties accept the same version. Client creates a submission link; freelancer submits real URL/file/notes; client requests a change; freelancer submits revision 2; client verifies every criterion and approves. Verify revision 1 and old agreements remain unchanged. Include unrelated-account denial and revoked/expired-link checks.
5. **Prove R6 while preparing that agreement.** Generate one live Gemini draft as the client, inspect its criteria, apply/edit/save it, and show that amounts, dates and acceptance remain authoritative. Log success or the exact sanitized failure; never substitute demo output.
6. **Run the controlled R5 payment only after explicit approval.** Verify the Sandbox Business/app owner, matching binding/fingerprint, deployed webhook ID and separate buyer. The assigned seller creates/sends exactly one invoice for the approved milestone. The client opens the verified Sandbox invoice URL and pays with the Sandbox buyer. Verify amount/currency/merchant/recipient/reference and PayPal-origin transaction totals from the authoritative invoice response. Confirm `payments.status=PAID`, `paid_at`, `last_verified_at`, history and processed verified event where webhook delivery is used. A redirect, screenshot of checkout or event name is not enough.
7. **Exercise recovery without inventing payments.** Reload/double-click/retry must retain one invoice/payment record. Resend a genuine webhook and verify no extra transition; verify invalid signatures are denied, delayed events reconcile, outages preserve prior confirmation and unrelated accounts cannot see or mutate records. Use disposable controlled fixtures for fault injection. Any cancellation/refund action also needs explicit authorization.
8. **Finish R8–R10.** Browser-check desktop/mobile and account switching; review the existing removed-switch diff; correct factual English copy without redesign. Ensure judges know the real account identities, in-app invitation behavior, single-merchant limitation, manual evidence review and separate simulation.
9. **Only then consider N1.** A small evidence-review assistant can strengthen the AI story, but the current P0 setup and live-provider proof are the first priority. Do not expand to marketplace payouts or browser automation merely to fill the remaining time.

### Submission acceptance gate

Do not mark the submission “fully verified” until R1–R7 have recorded passing evidence on the intended demonstration environment, with R8 browser navigation checked. Keep the 87 passing tests as regression evidence alongside, not instead of, the real integration run. The exact present blockers are the missing judge/seller project setup, unexercised authenticated workflow/RLS and upload isolation, absent real Gemini response evidence, absent complete Sandbox payment/webhook evidence, and unverified deployed environment. No redesign is needed to address these blockers.
