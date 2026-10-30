# ProofPay Judge Access — delivery and setup

## IMPLEMENTED

- `/judge-access`: public, responsive Client/Freelancer choices with normal sign-in, clear access instructions and a separate simulated demo link.
- `/judge-workspace`: existing authenticated workspace shell, current account and perspective, designated project selector, current agreement version/acceptance, latest submitted evidence and human approval counts, a membership-aware next action, and recorded PayPal Sandbox invoice status.
- Missing configuration, invitations, membership or records produce setup instructions. Failed reads produce unavailable/retry states. Nothing creates a sample record, AI report, approval or payment on entry.
- Login/signup retain Supabase Auth. Judge destinations survive the login/signup link and signup email confirmation; explicit return links take priority over an older tab-local return path. Choosing another signup perspective updates the judge destination. Normal signup confirmation URLs remain unchanged.
- White Quiet Precision surfaces, forest accents, local DM Sans and Manrope typography, restrained borders, clearer forms/status cards, mobile layouts, visible focus, labelled dialogs, keyboard-contained mobile navigation, Escape dismissal, background inertness, skeletons and reduced-motion support.
- Payment next-action copy now points to payment history instead of incorrectly asserting that no invoice exists. Dashboard labels distinguish accepted work and planned budget from payment.

## Authentication and isolation

There is no public session-creation endpoint, privileged impersonation, shared credential, service-role client, auth bypass, automatic acceptance or financial operation. Judge access is a guided entry into the actual application with the visitor's own Supabase identity. Existing authenticated visitors retain their identity. The selected perspective is a preference, not a grant of authority.

`PROOFPAY_JUDGE_PROJECT_IDS` is a comma-separated list of real Sandbox project UUIDs configured on the server. Empty or malformed configuration shows setup instructions. The guide intersects that list with loaded records and the authenticated account's actual project membership. IDs are passed to the browser and are not secrets. This filter is a presentation restriction, **not an authorization boundary**. Supabase RLS, checked RPCs and existing API checks remain authoritative. The normal workspace remains available with that account's existing permissions.

**Use dedicated, individually owned judge accounts that belong only to designated Sandbox projects.** Do not invite these accounts to confidential/live projects or distribute another person's password. For stronger environment isolation, use a separately configured Sandbox deployment/Supabase project; this change does not provision one or modify the existing Sites deployment.

The guide only sends authenticated `GET /api/payments` requests and renders recorded status. It does not create/send invoices, trigger reconciliation or start checkout. Financial actions remain on the existing Payments page, with the existing verified merchant binding, project-role checks and explicit user actions.

## Organizer setup still required

1. Have each judge create/confirm their own dedicated account, or sign into an account they own. Supabase's existing confirmation and password rules apply.
2. Prepare actual Sandbox projects using the normal project workflow. Pair separate client and freelancer accounts and invite the appropriate account by email inside ProofPay. Invitation emails are not automatically delivered; the invitee opens Invitations. A role preference does not add membership.
3. Set `PROOFPAY_JUDGE_PROJECT_IDS` in the Next.js server environment to the real project UUIDs. Restart/redeploy after changing it. Do not put records or credentials in source code. No schema change is required; do not rerun existing migrations.
4. In Supabase Auth URL configuration, retain existing production/local redirects and allow the deployment's judge confirmation destinations:
   - `/login?next=%2Fjudge-workspace%3Fperspective%3Dclient`
   - `/login?next=%2Fjudge-workspace%3Fperspective%3Dfreelancer`
   Use the full approved origin for each URL. Verify the emailed link returns to the guide on the deployed origin. Password recovery retains the existing flow; the judge can return through Judge Access afterward.
5. Use the existing Gemini server configuration for AI agreement drafting. Missing configuration must remain an explicit setup error/manual drafting path. Automated evidence verification and Browserless are not implemented.
6. Follow `PAYPAL-INTEGRATION-REPORT.md` for Sandbox credentials, webhook configuration and independently verified merchant binding. This deployment supports one configured merchant freelancer. Other freelancer accounts cannot issue invoices through that merchant. A judge must never be given another user's authenticated identity to bypass this restriction. Use only Sandbox buyer/merchant identities and test data.
7. Prepare the project's actual agreement and evidence through normal user actions. Leave incomplete steps incomplete; never seed successful verification or payment history for presentation.

## Preserved

Supabase session provider, RLS/RPC policies, database migrations, immutable agreements and evidence, delivery/review implementation, Gemini API, PayPal API/gateway/webhook and merchant authorization code are unchanged. Existing routes and the local simulated demo remain available. No deployment, database write, account creation or financial operation was performed for this work.

## VERIFIED

- `npm run typecheck` — passed.
- `npx tsc --noEmit` — passed.
- `npm test` — 72 passed, 0 failed. Five new judge tests cover safe return paths, invalid/absent project configuration, real membership versus selected perspective, isolation from other projects, latest agreement/submission history and failed-read states. Existing payment/auth/workflow tests also passed.
- `npm run build` — passed; `/judge-access` is prerendered, `/judge-workspace` is dynamic and uses the existing authenticated shell.
- Production HTTP smoke checks: Judge Access, both role-specific login/signup paths, judge workspace and demo returned 200. Public page HTML contains both choices and the correct encoded sign-in destinations. Signed-out workspace HTML contains the session-loading guard, not private records.
- Anonymous `GET /api/payments` and an invoice POST with placeholder UUIDs returned 401. No credential was supplied and no financial operation ran. These checks do not establish cross-account RLS correctness.
- `git diff --check` — passed.

## SIMULATED

Only the existing `/demo` walkthrough and explicitly illustrative marketing preview. No simulated data was introduced into the authenticated workspace. Unit-test fixtures are test-only and never inserted into Supabase.

## NOT IMPLEMENTED

One-click authentication, short-lived judge provisioning, automatic sample seeding, new quotas/audit infrastructure, automated evidence verification/Browserless, live payments and arbitrary-freelancer merchant onboarding. These have not been presented as working features.

## BLOCKED / UNVERIFIED

The browser automation host reported unavailable on both attempts; native app discovery timed out. No browser screenshots or visual/interaction verification were completed. CSS targets mobile/tablet/desktop, but actual 375px, 768px and 1440px layouts, overflow, keyboard navigation, dialogs and reduced-motion behavior still need browser QA.

Real two-account auth/RLS/private upload/review tests, deployed email confirmation redirects, configured Gemini responses, real judge records and PayPal Sandbox checkout/webhook reconciliation were not exercised. A successful build and unit tests do not verify these integrations. Until designated accounts/projects and merchant setup are ready, Judge Access correctly leads to setup states.

## Files changed by this work

| File | Purpose |
| --- | --- |
| `src/app/judge-access/page.tsx` | Public entry page and instructions |
| `src/app/(workspace)/judge-workspace/page.tsx` | Server configuration and judge route |
| `src/components/judge-workspace.tsx` | Real onboarding/status and setup states |
| `src/lib/judge-access.ts` | Role parsing, designation/membership intersection, current progress |
| `src/app/precision.css`, `src/app/layout.tsx` | Shared visual refinement and responsive styles |
| `src/components/auth-form.tsx` | Judge return flow and auth presentation |
| `src/components/workspace-shell.tsx` | Judge navigation, mobile keyboard behavior and loading state |
| `src/components/marketing/home.tsx` | Judge discovery and explicit demo label |
| `src/components/projects.tsx` | Accurate financial/invitation wording |
| `src/components/ui.tsx` | Accessible dialog naming |
| `src/lib/domain.ts` | Allowlisted judge return destination |
| `src/lib/project-workflow.ts` | Accurate post-approval payment guidance |
| `tests/judge-access.test.ts`, `tests/workflow.test.ts` | Regression coverage |
| `.env.server.example`, `README.md`, `JUDGE-ACCESS.md` | Configuration and delivery documentation |

Pre-existing edits to `AGENTS.md`, `next-env.d.ts`, `src/app/globals.css`, the existing logo asset and overlapping components were retained. The existing logo was inspected and reused; it was not generated or replaced in this task.
