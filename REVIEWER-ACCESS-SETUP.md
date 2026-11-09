# Reviewer access and one real Sandbox payment

## Latest launch check — 2026-11-08

Local Sandbox configuration validates, but the single OAuth attempt failed with `PAYPAL_NETWORK_ERROR`; merchant-binding SELECT failed with HTTP status 0. No credential-invalid response was observed. External checks stopped. Current merchant identity/binding, hosted invoice and deployed configuration remain unverified. No financial action was attempted. `scripts/payment-launch-readonly.ts` provides a bounded configuration/OAuth/binding check for the owner network: `node --env-file=.env.local --import tsx scripts/payment-launch-readonly.ts`. It prints statuses and roles only, not credentials/account identifiers; it cannot create/send/pay invoices.

Latest sequential checks: typecheck PASS; **215 tests / 89 browser scenarios PASS**; build **29/29 PASS**; **22 local production HTTP checks + Explore links PASS**. Secret-value scans: **217 tracked files / 35 built-client files**, four configured private values, **zero matches**; no private environment file tracked. Not a full Git-history or deployment audit. Temporary server stopped. Artifacts: `.validation/launch-readonly.log`, `launch-tests.log`, `launch-build.log`, `launch-http.log`. Branch `main`; prior OTP work preserved, uncommitted and not deployed.

No proven defect was found in the current payment authorization/create/send/reconciliation chain. No speculative workaround or redesign was introduced. Migrations 001–006 are existing history: **do not repeat migration work**; inspect deployed SQL only if a concrete live operation identifies a schema blocker.

Next sequence: establish the exact Vercel HTTPS deployment and authorize any needed release; verify OTP template/SMTP and a dedicated reviewer identity; approve a NEW small USD project (USD 10 remains a proposal), normally invite the unchanged merchant-bound freelancer and complete mutual terms/evidence/human approval; authorize that freelancer to create/send one invoice; authorize a dedicated Sandbox Personal buyer to pay once and require provider-verified PAID/history. **Never use the existing USD 123,123,123 project.** Merchant remains owner-operated. Later judges inspect completed history; another checkout needs a separately authorized eligible invoice. This supersedes the historical migration-first ordering below.

Updated 2026-11-08. Local base revision: `4a2fadd8` (`ui`); this work is uncommitted and not deployed. **Overall: PARTIAL — local implementation verified; hosted authentication and the real payment demonstration remain BLOCKED by owner setup/verification.** No emails, accounts, project mutations, migrations, invoices, payments, merchant rebindings or deployments were performed.

## 1. Status and exact scope

| Item | Status | Evidence / boundary |
| --- | --- | --- |
| Existing Explore cards, logo, fonts, layout | IMPLEMENTED / preserved | No changes to Explore, styles or assets |
| Existing password, Google, signup, recovery, simulation | IMPLEMENTED / preserved | Existing regression suite passes |
| Existing-account email OTP login | IMPLEMENTED; VERIFIED with isolated fixtures | Explicit passwordless choice on existing login form; `shouldCreateUser: false`; confirmed identity checked after OTP verification |
| Live OTP email delivery, expiry and provider rate settings | BLOCKED / UNVERIFIED | Supabase dashboard, SMTP and email-template settings were not inspected or changed |
| Arbitrary reviewer inheritance of prepared accounts/projects | NOT IMPLEMENTED intentionally | Identity and actual project membership remain authoritative |
| Real Sandbox invoicing and payment verification | IMPLEMENTED; live E2E BLOCKED | Existing single-merchant backend unchanged; no real invoice/payment exercised |
| Specific invoice guest checkout | UNVERIFIED | No current unpaid invoice or hosted checkout inspected; never promise guest checkout |
| Migration 005 hosted deployment | BLOCKED / UNVERIFIED | Previous PGlite execution passed; historical report says not applied. No current hosted SQL-definition evidence |
| Current deployed application revision | BLOCKED / UNVERIFIED | No verified Vercel project/hostname/revision supplied; local build is not deployment |

The reported 113 tests were a historical checkpoint. Immediately preceding work passed 209. Current full suite passes **215 tests, 0 failed, 0 skipped**, including **89 browser scenarios** (two new OTP flows). TypeScript and production build pass; 29/29 static pages. Tests ran sequentially with installed equivalents of the package scripts because `npm` is not on this shell's PATH: `tsc.exe --noEmit`, Node `--import tsx --test --test-concurrency=1 tests/*.test.ts tests/browser/*.test.mjs`, then Node `node_modules/next/dist/bin/next build`. Restored the original `next-env.d.ts` after build and rechecked types. Diff whitespace check passes.

Browser tests use real React components with isolated Auth/data/router fixtures and the existing test-only `PROOFPAY_FIXTURE_NO_SANDBOX=1` flag. They prove local behavior, not live email delivery, hosted RLS, guest checkout or a financial transaction. Existing SQL tests were not repeated: no SQL changed. Existing financial/auth/API tests remained included. Artifacts: `.validation/reviewer-tests.log`, `reviewer-build.log`, `client-experience/component-results.json`, `client-experience/login-otp-{client,freelancer}.png`. Mobile OTP/error screenshot was visually inspected; original design remains intact.

The bounded existing read-only Supabase script was attempted, but returned unavailable reads (`count:null`, no error code) instead of usable results. It was stopped without retrying provider operations. These are **not zero-row findings**. The previous audit observed two confirmed users, Judge Client with no membership, the configured merchant with a client membership in another project, a matching active stored binding, and no invoice/workflow records. Those are historical observations, not current live assertions. `reviewer-readonly.log` contains only sanitized read outcomes.

## 2. Exact reviewer login experience

1. Open Explore ProofPay and select Client or Freelancer. The existing cards still lead to `/login?next=...`.
2. Existing sessions still require explicit account acknowledgment; selecting a role never signs into another account.
3. Choose **Sign in without a password**, enter your own **already registered** email, and select **Email a sign-in code**.
4. Enter the six-digit code from that inbox, then **Verify code and sign in**. The app validates the returned session against `auth.getUser`, confirmed email and the requested address before proceeding.
5. The safe `next` destination preserves the selected perspective. Project access still depends on membership. An unassigned reviewer sees their own empty workspace, not the prepared project.

No account is created by this OTP path. For a new reviewer, an owner may explicitly provision/invite their identity through approved Supabase administration, or the reviewer may explicitly use the existing signup/Google journey. That does not add project membership. Google/password/signup/recovery remain available and were not rewritten. This is passwordless **email ownership verification**, not credential-free or anonymous access.

The request button has a synchronous duplicate lock and reuses the 60-second local cooldown for usability. Supabase Auth's server-side send and verification limits are the actual abuse control; no application in-memory limiter is claimed as a security boundary. Unknown-account requests use neutral copy; rate-limit and delivery failures are sanitized. OTPs, sessions and passwords are not logged, placed in URLs, saved as custom app state, or published. Supabase manages the normal authenticated session cookies. No admin Auth API or service key is used in the new client code.

## 3. Owner Supabase setup before advertising OTP

- Confirm Email provider is enabled on the intended Supabase project. Keep email confirmation, normal signup/recovery and OAuth settings intact.
- Configure a deliverable SMTP service for reviewer-owned addresses; verify sender/domain and provider quotas. Default restricted mail service must not be assumed to deliver to every reviewer.
- In **Authentication → Email Templates → Magic Link**, configure the OTP email body to include `{{ .Token }}` (a six-digit code for this UI). Example: `Your ProofPay sign-in code is {{ .Token }}. Enter it only on ProofPay. If you did not request this, ignore this email.` This is the Magic Link/OTP template only; do not replace the existing signup-confirmation or recovery templates. Prefer a code-only email for this path rather than introducing an unreviewed callback.
- Set Email OTP expiry to a short owner-approved duration, for example **600 seconds**, and verify the deployed setting. The client cannot enforce server token expiry. Do not claim the sample duration is currently configured.
- Review Supabase Auth send/verification rate limits and SMTP quotas. Keep conservative limits; do not disable abuse protection for judges. Consider provider CAPTCHA separately if needed; no CAPTCHA bypass or new CAPTCHA integration was added.
- Preserve current Site URL and Google PKCE callback configuration. Add the approved HTTPS login/confirmation/recovery redirects required by the existing flows. OTP entry itself needs no callback; the SDK's fallback email redirect is sanitized to the current origin and allowed workspace path.
- Use an existing test identity you control for one authorized email-delivery test. Verify receipt, expiry, invalid-code rejection, new-code behavior, correct Client/Freelancer return, account switching, and no membership inheritance. This document does not authorize sending to arbitrary reviewers.

Until these settings and delivery are verified, the OTP implementation is **not a verified working hosted email channel**. If the email contains only a link and no code, correct the Magic Link template; do not share session tokens or use an admin impersonation endpoint as a workaround.

References: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [OTP API](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). Actual project settings must be inspected independently.

## 4. Protected project access and minimal safe judging alternative

ProofPay projects have one actual client and one assigned freelancer. A new reviewer email is a new identity and cannot inherit either role. `PROOFPAY_JUDGE_PROJECT_IDS` is only a display filter; it never grants access. Do not add arbitrary spectators to `project_members`, reassign an accepted freelancer, or weaken RLS to make the demo easier.

For one prepared project, the safest minimal alternative is an owner-guided session: the actual client opens the project and history; the actual merchant operates the freelancer account. If independent reviewer control is necessary, share **only a dedicated test-only client account** through a controlled private instructions channel, after confirming it contains no unrelated/personal projects. Never share the owner's personal merchant login or its inbox. Do not forward live access/refresh tokens. Account credentials are not included in this repository or public UI.

If the existing prepared accounts contain unrelated data, do not give them to judges. Instead use a reviewer-owned client identity and a new small project that normally invites the existing merchant-bound freelancer. The merchant accepts and performs seller actions personally. Each separate real payment test needs its own valid project/milestone/approval/invoice lifecycle; do not reset a paid invoice or automatically seed history.

## 5. Merchant, migration and provider checklist

The only authorized invoice issuer is the actual Supabase user selected by **`PAYPAL_FREELANCER_USER_ID`**, with matching active/verified `paypal_merchant_bindings`, merchant ID/email and credential fingerprint. The owner must identify that user privately in Supabase Auth and independently match the REST app to its Sandbox Business owner. This is not an arbitrary new “Judge Freelancer.” Current account UUID/email and ownership were not freshly verified; no personal identifier or credential is published here. **No rebind is required or permitted by this work.**

Before any invoice action:

- Administrator compares deployed `claim_paypal_payment` definitions/grants with migration 005 using `scripts/schema-inspection.sql`, also accounting for later reviewed migrations. Presence of an RPC name does not prove its version. Apply only genuinely missing, reviewed changes after explicit approval; never rerun 001–004 or blindly overwrite newer definitions. No migration was run here.
- Verify project client and bound freelancer memberships, current mutually accepted agreement, approved latest submission, confirmed payer email, positive owner-approved small USD amount, and no existing invoice for the milestone. Approval does not itself create/pay an invoice.
- Check local/deployed `PAYPAL_ENV=sandbox`, unchanged merchant configuration and same-app webhook subscription at `https://<approved-host>/api/paypal/webhook`. Do not print secrets while comparing configuration.
- Confirm the intended invoice recipient snapshot is compatible with the separately controlled Sandbox Personal buyer. A ProofPay login email and PayPal buyer account are distinct identities; establish the recipient/account setup before invoicing. Do not change an issued invoice's payer snapshot to make checkout pass.
- Confirm signature verification and authoritative invoice GET reconciliation remain enabled. A browser success screen/redirect alone is not payment proof.

[PayPal Sandbox accounts](https://developer.paypal.com/sandbox-testing/accounts) documents separate test account credentials; [Invoicing quick start](https://developer.paypal.com/api/invoicing) uses a Sandbox Personal recipient. Guest/card checkout for this specific invoice is **unknown**. Plan for dedicated Sandbox Personal buyer login unless the owner verifies guest checkout on the actual hosted invoice. Keep buyer credentials in a private reviewer-instructions channel, never HTML, JavaScript, query strings, Git, screenshots or this file. No real card details.

## 6. Shortest procedure for ONE controlled Sandbox payment

1. Owner completes the migration/deployment/merchant/buyer checks above and authorizes one small test. Sign into actual client and bound freelancer in separate browser profiles. Confirm displayed account identities.
2. Open the prepared project and inspect its accepted agreement, evidence revisions and human review. If absent, create a NEW owner-approved small USD project through the ordinary client workflow, invite the bound merchant, have both accept, submit evidence and manually approve. Do not manufacture successful database states.
3. In freelancer **Earnings**, create/send the eligible milestone invoice **once**, only if no invoice already exists. No reviewer should impersonate the seller. If result is ambiguous, inspect/reconcile that operation; never issue a blind replacement.
4. As the actual project client, open **Payments**. For a genuinely **UNPAID** record with a verified checkout URL, choose **Pay on PayPal Sandbox**. Check `www.sandbox.paypal.com`, amount, USD, seller and recipient. PayPal buyer authentication is separate; use the dedicated test Personal buyer as required by the hosted page.
5. After that one authorized payment, return to ProofPay. Await signature-verified webhook reconciliation or use **Refresh PayPal status**. Require authoritative **PAID**, a matching provider transaction and recorded payment history. Pending/error is not success; do not pay again because an app refresh is delayed.
6. Later judges inspect the paid invoice/history as evidence. The UI now states it cannot be reused. Another real payment test requires a separately authorized eligible milestone/project and invoice. Use the existing clearly labeled simulation for repeatable practice, never as proof of a PayPal transaction.

## 7. Files and remaining gates

New: `src/lib/reviewer-auth.ts`, `src/components/reviewer-sign-in.tsx`, `tests/reviewer-auth.test.ts`, this document. Modified: `src/components/auth-form.tsx` (optional OTP choice), `src/components/payments.tsx` (buyer-auth/already-paid copy only), browser fixture/test and preview module list, documentation pointers. No CSS, assets, Explore cards, API/payment backend, provider, RLS, migrations, Google callback or dependencies changed.

IMPLEMENTED: optional passwordless existing-account path, safe identity/return validation, duplicate suppression, accurate payment instructions. VERIFIED: isolated local checks above. BLOCKED: hosted email delivery/config, current migration 005 equivalence, deployed revision/config, genuine unpaid invoice/guest-checkout availability and one authorized provider transaction/webhook E2E. NOT IMPLEMENTED: anonymous prepared-account access, automatic reviewer membership, merchant impersonation, shared public sessions, repeated payment of one invoice, automatic invoice creation/reset, new payment backend. No live integration success is claimed.
