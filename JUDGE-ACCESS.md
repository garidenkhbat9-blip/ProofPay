# Explore ProofPay: architecture correction

2026-11-08 update: the preserved login now offers optional existing-account email OTP. Hosted template/SMTP setup and real payment verification remain external gates. See [REVIEWER-ACCESS-SETUP.md](REVIEWER-ACCESS-SETUP.md) for current status and the controlled single-payment procedure; historical checks below are not current deployment evidence.

## Audit findings

1. Client/Freelancer are presentation perspectives, deliberately available to one account because project roles can differ between projects. Supabase identity is separate from `project_members`, the UI preference, and verified PayPal merchant ownership.
2. Explore sent both choices to a separate `/judge-workspace` page. Its query parameter changed the view of the current account. Login automatically reused an existing session without identifying that distinction.
3. The sidebar exposed a dedicated Judge guide alongside the normal Overview. Both offered onboarding and next actions, creating two competing starting points.
4. The old guide filtered projects by `PROOFPAY_JUDGE_PROJECT_IDS` plus actual membership and perspective. Missing/invalid configuration produced "Your Sandbox project needs setup" even when the account had ordinary projects. This was a presentation configuration condition, not evidence that a project was absent.
5. Provider defaults used account-local storage and auth metadata but did not consult loaded profile/membership records. The existing profile schema defaults to Client. First-time guidance was partly implemented in uncommitted workspace changes and needed integration with the public flow.

The audit covered routes, auth/session provider, safe returns, sidebar, profile schema, cloud loading, membership/RLS and invitation RPCs, project next-step selectors, existing onboarding, and dependencies of the judge status/payment reader. No database query, migration, user/account creation, or payment operation was needed.

## Navigation and account behavior

Landing -> Explore ProofPay -> Client or Freelancer -> normal Supabase sign-in -> `/dashboard`.

- Client entry: `/login?next=%2Fdashboard%3Fperspective%3Dclient`.
- Freelancer entry: `/login?next=%2Fdashboard%3Fperspective%3Dfreelancer`.
- An already signed-in visitor sees their current account and can explicitly continue with it or sign out and authenticate with another account. No account is impersonated, created or selected by the perspective parameter.
- `/judge-access` still redirects to `/explore`.
- `/judge-workspace` is a compatibility redirect outside the authenticated layout, preserving a valid Client/Freelancer parameter and otherwise returning to `/dashboard`. The dashboard retains the existing session guard.
- Explicit entry intent is applied once and removed from the dashboard URL. Later voluntary perspective changes remain available in a collapsed, explained sidebar control.
- Initial perspective priority: valid entry intent, account-scoped saved preference, valid auth metadata. If none exists, a sole role in loaded projects is used; otherwise the current account's stored profile preference, then Client. This avoids legacy default-Client profiles hiding an established freelancer's projects. These are UI defaults, never authorization.
- Explicit safe return paths take priority over older tab-local pending paths. Signup confirmation and password recovery retain requested safe destinations. Actual account sign-out clears pending return state and account records.
- Account email and active perspective remain visible; missing names use neutral copy. No project count is used as evidence of a first login.

## One dashboard and contextual onboarding

Client without projects:

- "Welcome to ProofPay."
- "Start with a project, invite your freelancer, and agree on what success looks like."
- "Create your first project" -> `/projects/new`.
- Create a project; Invite a freelancer; Agree on milestones; Review delivered work.

Freelancer without projects or invitations:

- "Your workspace is ready."
- "Once you're invited to a project, you can review the agreement, deliver work, and track approvals."
- "Check invitations" -> `/invitations`.
- Accept an invitation; Agree on project scope; Submit evidence; Follow review and payment status.

A real incoming, pending, unexpired invitation takes priority with Review invitation. Failed invitation reads show an unavailable/retry notice. Existing project next actions follow actual membership, current agreements, acceptance, submissions and review state. Approval is never presented as payment. If the account has projects only in the other perspective, a contextual action explains and opens that view without changing identity.

The sidebar no longer contains Judge guide. A collapsed How ProofPay works section sits in the normal dashboard. Designated project filtering and recorded agreement/evidence/review progress remain in an optional collapsed Prepared Sandbox projects section. It appears only for configured projects the current account can actually access in the active role. Missing/invalid configuration falls back to the normal workspace and accurate role-specific empty state, not an organizer setup journey. The duplicate payment reader was removed after confirming the existing Payments workspace provides recorded status, errors and merchant authorization. The compact section links there.

The ivory/white surfaces, forest accents, logo and typography remain. Existing responsive navigation, focus containment, Escape dismissal, focus styles and reduced-motion CSS are retained. Added account text wraps on narrow screens; guidance uses native links, buttons and disclosure controls.

## Security and integration boundaries

Supabase identity remains the authenticated session. Membership/RLS/RPC checks remain authoritative for project access and actions. UI selection cannot add membership or authorize payments. The provider's existing account epoch and disposed-read guards prevent a previous account's load from publishing into a new account. No RLS, migration, Gemini service, PayPal environment variable, invoice service, webhook, merchant binding or real data was modified.

Only the existing `/demo` is simulated. The workspace uses real records. PayPal Sandbox uses test payments and supports one configured merchant freelancer; an arbitrary freelancer cannot receive payments through that merchant. There is no one-click authentication.

## Files changed in this correction

All paths are relative to `proofpay-next`:

- `src/app/explore/page.tsx`: matching account guidance and dashboard entry links.
- `src/app/(workspace)/dashboard/page.tsx`: optional server-side project designation configuration.
- `src/app/(workspace)/layout.tsx`: Suspense boundary for URL-aware entry handling.
- `src/app/(workspace)/judge-workspace/page.tsx` -> `src/app/judge-workspace/page.tsx`: compatibility redirect outside the authenticated shell.
- `src/app/precision.css`: onboarding heading, wrapping identity text and compact account/project details.
- `src/components/auth-form.tsx`: existing-account acknowledgment, real sign-out/re-authentication and safe confirmation/recovery destinations.
- `src/components/provider.tsx`: initial UI defaults, stable perspective callback and account-safe sign-out return handling.
- `src/components/workspace-shell.tsx`: consume entry intent, remove Judge guide, visible account identity and clearer secondary switching.
- `src/components/projects.tsx`: single dashboard, contextual other-role projects and optional prepared-project details.
- `src/components/workspace-onboarding.tsx`: requested empty-state heading and accurate integration copy.
- `src/components/judge-workspace.tsx`: replace duplicate full-page journey with compact real-record details.
- `src/lib/auth-navigation.ts`: testable existing-account acknowledgment and safe return selection.
- `src/lib/judge-access.ts`: canonical destinations and validated legacy entry parsing; designation/progress selectors retained.
- `src/lib/workspace-sync.ts`: membership/profile fallback for presentation only.
- `src/lib/workspace-onboarding.ts`: exact requested onboarding copy and actual other-perspective projects.
- `src/lib/types.ts`: existing optional profile preference represented in TypeScript; no schema change.
- `tests/auth.test.ts`, `tests/judge-access.test.ts`, `tests/navigation.test.ts`, `tests/workspace-onboarding.test.ts`: account acknowledgment, safe destinations, route rendering/redirects, initial perspectives, mixed membership and empty states.
- `README.md`, `JUDGE-ACCESS.md`: current architecture, verification and setup.

Pre-existing uncommitted work in overlapping files was retained and integrated. `src/components/account.tsx` was already modified and was not edited in this correction. Next.js regenerated `next-env.d.ts` during the required build.

## Organizer setup (manual)

1. Configure the two separate real Supabase identities, Judge Client and Judge Freelancer, outside application code. Confirm their emails and supply access securely. Set the corresponding `preferred_workspace` auth metadata/profile preference if desired. The explicit Explore entry works without that optional preference.
2. Use normal project creation for the Client and invite the Freelancer's verified email. The existing invitation workflow assigns only Freelancer membership; it cannot invite a second Client. Have Judge Client own/create the designated project, or use an already authorized Client membership. No code here changes memberships. Invitations appear in-app; automatic invitation email delivery is not connected.
3. Optionally retain/set `PROOFPAY_JUDGE_PROJECT_IDS` to real project UUIDs for the compact prepared-project summary. It is not required for normal dashboard access and never grants access. Do not expose credentials or seed successful outcomes.
4. In Supabase Auth URL configuration, allow the deployed full-origin login and reset destinations used here, including `/login?next=%2Fdashboard%3Fperspective%3Dclient`, the Freelancer equivalent, and corresponding `/reset-password?next=...` URLs. Retain existing production/local and legacy confirmation redirects. Verify actual confirmation and recovery emails on the deployed origin.
5. Keep the current Gemini/PayPal server configuration and independently verified merchant binding. The designated Freelancer must be the configured merchant to issue Sandbox invoices. Do not impersonate that merchant or enable arbitrary-freelancer payouts. Follow the existing PayPal integration report for integration setup.
6. No new migrations, environment-variable changes, deployment or Git push were performed. Deploy only through the owner's normal review process.

## Verification and remaining limitations

- `npm run typecheck`: passed. `npx tsc --noEmit`: passed. `npm test`: 87 passed, 0 failed. `npm run build`: passed (Next.js 16.4.2 production build).
- Regression tests cover actual route rendering/redirect functions, safe return paths, existing-account acknowledgment, initial view defaults, account-specific preference keys, membership-only filtering, mixed project roles, invitation expiry/failure, contextual next actions and exact empty-state copy. Existing payment, cloud-loading, auth and workflow tests remain included.
- Local production HTTP checks passed: `/judge-access` returns 307 to `/explore`; both valid legacy role URLs return 307 to the matching dashboard destination; invalid/duplicate roles return 307 to `/dashboard`. Explore, both role-specific login URLs, dashboard and demo return 200; Explore contains both correct login links and the signed-out dashboard contains the session-loading guard. HTTP/SSR checks are not browser interaction or visual QA.
- `git diff --check`: passed. Protected integration, payment, migration and RLS source files were not changed.
- Browser inventory failed with "The browser access host is unavailable" on both attempts; native-app inventory also timed out. Desktop/mobile screenshots, keyboard interaction and live browser session transitions were not verified.
- Live two-account Supabase RLS, private uploads, invitation acceptance, actual confirmation/recovery redirects, Gemini responses and PayPal Sandbox checkout/webhook reconciliation remain manual checks. Unit tests do not establish deployed RLS correctness.
