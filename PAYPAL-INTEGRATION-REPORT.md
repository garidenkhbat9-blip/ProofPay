# ProofPay PayPal Sandbox integration report

Date: 2026-10-29

**Classification: IMPLEMENTED BUT NOT FULLY VERIFIED.** Activation is blocked by merchant/webhook configuration, undeployed/unverified database changes, and unavailable validation runtimes. No real PayPal Sandbox invoice, payment, refund, or live transaction was executed in this session. No migration was applied to an existing database.

## SECTION A — IMPLEMENTED FEATURES

### Financial ownership and authorization

- Supported flow: the **assigned freelancer**, whose Sandbox Business account owns the configured REST app, issues an invoice to the **project client's verified Supabase email**. The client pays through the PayPal-hosted Sandbox invoice experience. Funds belong to that configured freelancer merchant; ProofPay does not receive funds and subsequently pay out freelancers.
- Merchant ownership requires an independently verified, explicitly enabled database binding: freelancer UUID, Sandbox merchant ID/email, and SHA-256 fingerprint of the REST app client ID. Browser metadata and workspace perspective cannot establish ownership or permissions.
- A shared platform REST app **cannot** invoice on behalf of arbitrary freelancers in this implementation. Other freelancers remain blocked. Partner onboarding, multiparty permissions, payouts, escrow and live payments are not implemented or silently substituted.
- Server routes validate the bearer token through Supabase `auth.getUser`, verified email, project membership and role. Only the assigned freelancer can create/send. Either project member can refresh. The database independently checks the actor, latest mutually accepted agreement, latest approved evidence, client review, merchant binding, payer, positive amount and USD currency.

### Provider workflow and correctness

- Fixed Sandbox API base; server-only configuration and OAuth token cache. No runtime option can switch to a live API endpoint.
- Real Invoicing v2 create, send, get and search operations; no simulated capture or browser-reported success.
- The accepted milestone amount and currency are snapshotted by SQL. Browser amounts, invoice recipients, merchant IDs and payment-status claims are not accepted as request inputs.
- One payment record per milestone, stable operation UUID/invoice number, unique provider invoice ID, immutable financial snapshot and database leases across server instances.
- A durable attempt marker precedes invoice creation. After an ambiguous result, retries search for the existing invoice; an empty search never authorizes another create. A definitive create-time HTTP authentication/permission rejection can allow another attempt after correction. Database attachment failure stops invoice sending and leaves the original attempt recoverable.
- Stable `PayPal-Request-Id` values are supplied, but safety does **not** depend on undocumented or indefinite provider retention of that header. Sending a known draft is preceded by an authoritative GET; an already sent/paid invoice is not sent or created again.
- Hosted URLs are accepted only on `https://www.sandbox.paypal.com/invoice/...`. Returning to ProofPay does not establish payment success.
- `PAID` requires matching invoice identity, operation reference, merchant email, recipient, amount and currency; zero balance; and unique PayPal-origin payment transactions totaling the agreed amount. Manual/external payment records do not qualify. Full refund confirmation requires corresponding PayPal-origin refund records. Discrepancies become Action Required.
- Previously verified paid/refunded history cannot revert into a fresh unpaid checkout after a conflict or stale check. Provider update times and database lease tokens prevent stale writes. Failures preserve confirmation timestamps, record sanitized diagnostics and remove the checkout link until verified again.

### Webhooks and recovery

- `POST /api/paypal/webhook` verifies signatures with PayPal's `verify-webhook-signature` endpoint and the registered webhook ID. It does not download arbitrary certificate URLs.
- Verified events are durably recorded before acknowledgment. Records contain event identity/type, invoice identity, payload hash, processing state, attempts, timestamps and sanitized errors; raw customer payloads are not exposed to the browser.
- Duplicate processed events are recognized; failed events remain retryable. Out-of-order events trigger an authoritative invoice GET rather than applying the event's reported status.
- Unknown/unattached invoice events remain failed/retryable and never mark a different milestone paid. A webhook that arrives before invoice attachment can be retried after invoice recovery.
- Processing is awaited; no untracked background promises or in-memory-only event queue. Database/write/provider failures return non-2xx so PayPal can retry. Merchant-dashboard resend and member-initiated reconciliation cover delayed/missed events.

### UI and diagnostics

- Existing Payments/Earnings page now shows approval readiness, Sandbox invoice state, authorized create/send actions, hosted checkout, pending/confirmed/cancelled/refunded states, recent history and explicit provider refresh.
- Visible online pages refresh stored history at 30-second intervals and on focus/reconnect. Background page refresh does not repeatedly call PayPal. Manual provider checks are serialized and briefly throttled in SQL.
- Existing delivery UI links to the milestone's payment status. Client approval still does not move money. Demo payment simulation remains isolated and unchanged.
- Central diagnostics include code, safe message, operation, known cause or unknown, recovery action, retry safety, correlation ID, timestamp and an optional sanitized PayPal debug ID. No credentials, access tokens, raw provider error descriptions or stack traces are returned to users or printed in payment logs.
- Regular users receive actionable setup/recovery messages; provider/database diagnostics remain sanitized. Outage displays explicitly say that the current check has not confirmed payment.

### Explicit provider status mapping

| PayPal invoice status | ProofPay status |
| --- | --- |
| DRAFT | DRAFT / Invoice Created |
| SENT, UNPAID, SHARED | UNPAID / Awaiting Payment |
| SCHEDULED, PAYMENT_PENDING, PARTIALLY_PAID | PAYMENT_PENDING |
| PAID, with matching PayPal transaction evidence and zero balance | PAID |
| CANCELLED, AUTO_CANCELLED | CANCELLED |
| REFUNDED, with matching full PayPal refund evidence | REFUNDED |
| MARKED_AS_PAID, PAID_EXTERNAL, MARKED_AS_REFUNDED, REFUNDED_EXTERNAL, PARTIALLY_REFUNDED, unknown or conflicting states | REQUIRES_ATTENTION |

ProofPay also uses NOT_STARTED, CREATING and FAILED for local operation state. There is no assumption that PayPal has identical status names. Cancellation/refund actions themselves remain in the Sandbox merchant dashboard; this application reconciles their outcomes.

Official references: [Invoicing v2](https://developer.paypal.com/api/invoicing/v2), [invoice schema and statuses](https://developer.paypal.com/api/invoicing/v2/schema.json), [send semantics](https://developer.paypal.com/api/invoicing/v2/invoices-send), [signature verification](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post), [webhook retries](https://developer.paypal.com/api/rest/webhooks/), [partner invoicing requirements](https://developer.paypal.com/platforms/invoicing/integrate).

## SECTION B — MODIFIED FILES

Created:

- `migrations/004_paypal_sandbox.sql`
- `src/lib/payments/config.ts`
- `src/lib/payments/errors.ts`
- `src/lib/payments/gateway.ts`
- `src/lib/payments/model.ts`
- `src/lib/payments/webhook.ts`
- `src/lib/payments/workflow.ts`
- `src/lib/server/payments.ts`
- `src/components/payments.tsx`
- `src/app/api/payments/route.ts`
- `src/app/api/paypal/webhook/route.ts`
- `src/app/api/projects/[id]/milestones/[milestoneId]/invoice/route.ts`
- `src/app/api/projects/[id]/payments/[paymentId]/refresh/route.ts`
- `tests/payments.test.ts`
- `tests/payments-authorization.sql`
- `PAYPAL-INTEGRATION-REPORT.md`

Changed:

- `src/components/account.tsx` — payment page entry and connection wording.
- `src/components/delivery.tsx` — Sandbox payment status navigation.
- `src/lib/server/http.ts` — required-role error names the actual required role.
- `.env.server.example` — empty server-only configuration placeholders and ownership requirements.
- `README.md` — Sandbox setup/report reference and current integration limitations.

Ignored validation artifacts created/updated:

- `.validation/paypal-before/hashes.json`
- `.validation/payment-policy-results.json`
- `.validation/paypal-syntax-results.json`

No dependency manifest/lockfile changes, previous migration edits, CSS changes, demo changes, existing database writes, accepted-agreement changes, or secret-value edits were made. Earlier stabilization changes remain intact.

## SECTION C — DATABASE CHANGES

Migration 004 adds:

1. `paypal_merchant_bindings`: admin-verified direct-merchant ownership, disabled by default.
2. `payments`: immutable agreed financial identity, unique milestone/operation/provider invoice association, creation attempt/retry state, lease, provider state, reconciliation metadata and timestamps.
3. `payment_history`: append-only application history of verified state changes.
4. `paypal_webhook_events`: durable verified-event processing/retry records.
5. RLS and column-level grants: members can read permitted invoice/history fields; browsers cannot read private recipient snapshots, merchant bindings, provider snapshots or webhook records, and cannot mutate payments.
6. Service-only prepare/claim/attach/finish/fail RPCs. Public, anonymous and authenticated execution is revoked. An immutability trigger prevents replacing agreed financial identity, an attached invoice ID or the original creation-attempt timestamp.

Deployment steps:

1. Use a disposable/local Supabase instance or staging branch first. Confirm migrations 001–003 are already present; do not rerun them.
2. Inspect existing schema without changing records:

   ```sql
   select to_regclass('public.projects'), to_regclass('public.agreements'),
          to_regclass('public.submission_reviews'), to_regclass('public.payments'),
          to_regclass('public.paypal_merchant_bindings');
   ```

3. If payment objects already exist, STOP and reconcile the migration ledger/definitions. Migration 004 intentionally does not conceal conflicts with `IF NOT EXISTS`.
4. Review and apply **only** `migrations/004_paypal_sandbox.sql` once as the database administrator. It is transactional and additive. Refresh the REST schema cache with `notify pgrst, 'reload schema';` if needed.
5. On the disposable database, run `tests/payments-authorization.sql` with `psql -v ON_ERROR_STOP=1`. It creates random test identities/data inside a transaction and rolls back; do not point it at production.
6. Verify member/outsider access with real authenticated sessions, then deploy the same reviewed migration to the intended project. Keep merchant bindings inactive until ownership verification is complete.

The migration and SQL tests were **not executed** in this session. Their actual PostgreSQL behavior must be verified before activation.

## SECTION D — PAYPAL CONFIGURATION

Server-only variables:

| Name | Purpose | Observed session state |
| --- | --- | --- |
| PAYPAL_ENV | Must be exactly `sandbox` | Present; not runtime-validated |
| PAYPAL_CLIENT_ID | Sandbox REST app identity | Present; not authenticated/tested |
| PAYPAL_CLIENT_SECRET | Sandbox REST app secret | Present; not authenticated/tested |
| PAYPAL_WEBHOOK_ID | Subscription ID on that same Sandbox app | Missing |
| PAYPAL_MERCHANT_ID | Actual owner merchant account ID | Missing |
| PAYPAL_MERCHANT_EMAIL | Actual owner Sandbox Business email | Missing |
| PAYPAL_FREELANCER_USER_ID | ProofPay freelancer owning that merchant | Missing |
| SUPABASE_SECRET_KEY | Server-only privileged payment RPC access | Present; not validated |

Existing public Supabase URL/publishable-key settings are also required for authentication. No private variable may use the `NEXT_PUBLIC_` prefix. Existing `.env.local` was not overwritten. Presence checks do not establish that a value is valid or usable.

## SECTION E — VERIFIED TEST RESULTS

| Check | Actual result |
| --- | --- |
| esbuild syntax transformation of all source/test TS/TSX files | **80 files passed**, zero syntax errors |
| Supplemental source-driven V8 payment policy/workflow checks | **20 passed, 0 failed** |
| Native Web API-dependent payment cases in that supplemental runner | **4 blocked/skipped** |
| `npm run typecheck` | Attempted; npm command unavailable, did not start |
| `npm test` | Attempted; npm command unavailable, did not start |
| `npm run build` | Attempted; npm command unavailable, did not start |
| Node payment test file | 24 cases added; not executed with Node |
| Complete Node regression suite | 67 cases now present; not executed with Node |
| PostgreSQL/RLS/lease tests | Script added; psql/database test runtime unavailable, not executed |
| Browser UI/visual QA | Browser access host unavailable, not executed |
| Real Sandbox OAuth/invoice/payment/webhook E2E | BLOCKED; no transaction performed |

The supplemental V8 run executes transpiled project policy/workflow code and test callbacks with a small assertion/test adapter, deterministic UUIDs, plain-object clone and header test doubles. It verifies logic and mocked orchestration, **not** Node, HTTP transport, real signature verification, Supabase, SQL atomicity or PayPal. Syntax checks are not a TypeScript typecheck or production build.

Failure-scenario coverage:

| Scenario | Verification performed / outstanding |
| --- | --- |
| Missing credentials/webhook/merchant settings, live mode | Configuration policy passed |
| Invalid amount/currency/recipient | Policy validation passed |
| Invalid credentials or merchant API permissions | Sanitized error mapping passed; HTTP adapter case and real API blocked |
| Duplicate requests/double-click | Mocked lease/orchestration passed; SQL concurrency test blocked |
| Network timeout/API outage | Lost-response workflow passed; native HTTP timeout/outage case blocked |
| Create failure or lost create response | Recovery-by-number/no-second-create policy passed |
| Send failure/lost send response | Existing-invoice reconciliation passed |
| Expired login/unauthorized project access | Server guards implemented; real auth/RLS tests blocked |
| Missing database migration | Diagnostic mapping passed; live schema check blocked |
| Database attachment/write failure | Mocked workflow passed; real database fault injection blocked |
| Invalid webhook signature | Reject-before-storage orchestration passed; actual verification endpoint case blocked |
| Duplicate/out-of-order webhook | Mocked durable processing/provider-read policy passed; live deliveries blocked |
| Pending/cancelled/already completed/manual paid | State and transaction-evidence policy passed |
| Confirmed paid/refunded followed by stale/conflicting state | History-preservation policy passed |
| Client reload | Durable design implemented; browser reload test blocked |
| Delayed confirmation/missing webhook | Mocked reconciliation passed; live delayed-event test blocked |

## SECTION F — BLOCKED ITEMS AND EXACT RECOVERY STEPS

### 1. Node/npm and complete validation

Missing: a Node 22+ runtime readable by this execution session. The earlier investigation found the NVM target inaccessible; this turn again found no `node`, `npm` or `psql` command. Installed project dependencies were retained.

Obtain: an accessible official Node LTS installation, or the official Windows portable distribution in `proofpay-next/.tools`. Configure the current terminal PATH to that runtime; do not change dependency versions to solve a runtime access problem.

Verify from `proofpay-next`:

```powershell
node --version
npm --version
npm run typecheck
npm test
npm run build
npm start
```

Resolve any actual failures before activation. The successful syntax/policy checks do not waive these commands.

### 2. Database deployment and authorization testing

Missing: a verified deployment of migration 004 and an executable disposable PostgreSQL/Supabase test environment. The presence of a server key does not prove schema state or access.

Obtain: a Supabase local instance/staging branch and SQL Editor or psql access from the project administrator. Follow Section C, run the rollback-only SQL tests, and then verify with client, freelancer, unrelated and anonymous sessions. Confirm direct browser `status='PAID'` updates and service-only RPC calls are denied.

### 3. Direct merchant ownership

Missing: merchant ID/email, freelancer UUID and an independently verified active merchant binding.

Obtain: in PayPal Developer Dashboard → Apps & Credentials → **Sandbox**, inspect the REST app's assigned Sandbox Business account. In the matching Sandbox account's business/profile details obtain its merchant ID/email. In Supabase Auth identify the actual freelancer's user UUID. Verify that this is the freelancer's authorized test merchant, not ProofPay's unrelated shared platform account.

Set the three corresponding server variables. Compute the client-ID fingerprint locally without printing the client ID or secret:

```powershell
node --env-file=.env.local -e "console.log(require('node:crypto').createHash('sha256').update(process.env.PAYPAL_CLIENT_ID.trim()).digest('hex'))"
```

After independently verifying ownership, the database administrator may insert the binding below, replacing placeholders. Do not run it with placeholders or without ownership verification:

```sql
insert into public.paypal_merchant_bindings
 (freelancer_id,merchant_id,merchant_email,credential_fingerprint,active,verified_at,verification_note)
values
 ('<freelancer UUID>','<13-character merchant ID>',lower('<Sandbox Business email>'),
  '<client-ID SHA-256 fingerprint>',true,now(),'<who verified ownership and how>');
```

Verify: authenticated Payments/Earnings no longer shows merchant setup blocked, the mapped freelancer can initiate an approved milestone invoice, and a different freelancer remains blocked. Confirm the generated draft's owning account in the Sandbox dashboard before the first end-to-end payment.

There is intentionally no browser “claim this merchant” operation. Invoicing v2 does not supply a merchant-ID field sufficient to replace the administrator's app/account ownership verification; subsequent checks use the credential binding and invoice merchant email. Rotating to a different merchant/app can block reconciliation of old invoices; do not rebind historical financial snapshots to a different owner.

### 4. Webhook ID and public HTTPS endpoint

Missing: a webhook subscription ID and a verified, reachable deployment URL for this Next.js webhook route.

Obtain: deploy this Next.js server to your approved HTTPS hosting environment after validation. In the **same Sandbox REST app**, register `https://<your-nextjs-host>/api/paypal/webhook` for CREATED, SENT, PAID, CANCELLED, REFUNDED, UPDATED and SCHEDULED invoice events. Copy the subscription ID into server-only `PAYPAL_WEBHOOK_ID`, then redeploy/restart. Keep existing authentication redirect URLs and unrelated deployments intact.

Verify: a real Sandbox invoice event passes PayPal verification, appears durably in `paypal_webhook_events`, and reaches PROCESSED only after invoice reconciliation. Resend the same event and confirm no duplicate financial action/history transition. Configure hosting rate limits appropriate for this public endpoint. Simulator notifications are not a substitute for a real invoice/payment E2E.

### 5. Test buyer, end-to-end payment and browser QA

Missing: verified test actors/accounts, a working application runtime and successful real Sandbox execution.

Obtain: separate Sandbox Business seller and Personal buyer accounts from PayPal Developer Dashboard → Testing Tools → Sandbox Accounts. Use controlled test identities in a non-production Supabase environment. Ensure the project's client has a verified intended invoice email; the invoice recipient is never supplied arbitrarily by the browser.

Verify: client creates project → invites freelancer → both accept agreement → freelancer submits evidence → client approves → mapped freelancer creates/sends Sandbox invoice → client opens hosted Sandbox link and pays using the test buyer → application confirms through verified webhook or GET reconciliation. Confirm PayPal transaction evidence, invoice amount/currency/recipient/merchant, one payment row and no duplicate invoice after reload/double-click. Test cancellation/refund in the merchant Sandbox dashboard, failed refresh, delayed webhook, and unrelated-account denial. Do not use live accounts or real money.

### 6. Multiple freelancers / platform payments

Missing: PayPal partner approval, seller onboarding and delegated invoicing permissions. Ordinary app credentials do not provide these.

Obtain: contact PayPal through the [partner invoicing program](https://developer.paypal.com/platforms/invoicing/integrate); approved integrations require onboarding and the relevant invoice/merchant-information permissions. This is separate integration work, not a server-variable switch. Until reviewed and implemented, only the explicitly bound direct merchant is supported. No platform-owned invoice is substituted for an unsupported freelancer.

## SECTION G — REMAINING ERRORS AND OPERATIONAL LIMITS

- Runtime TypeScript/build failures, SQL deployment issues and browser behavior remain **unknown**, because those checks could not run. No executed supplemental policy case is failing; that does not establish absence of bugs.
- An ambiguous create with no recoverable matching invoice stays REQUIRES_ATTENTION. Search again later and inspect the merchant dashboard/reference. Do not clear the durable marker or issue a replacement based only on an empty search. If the outcome remains unknown, obtain provider confirmation and a separately reviewed operational correction. The deliberate block favors avoiding duplicate financial operations.
- If a send fails, refresh to recover the authoritative draft/sent state before retrying. Archived/superseded agreements cannot start a new invoice operation; already issued invoices remain historical obligations and may require merchant-dashboard cancellation. New agreement versions do not rewrite existing payment snapshots.
- Provider-unavailable checks retain historical confirmations but do not assert a new confirmation. Identity/amount conflicts disable checkout until resolved. External/manual payment and partial-refund states require merchant review.
- Unknown invoice events remain retryable rather than being treated as milestone payments. After invoice attachment/recovery, resend from the Sandbox webhook dashboard. There is no automatic cron worker; authorized refresh and provider retries/resends are the implemented recovery mechanisms.
- History UI is capped at 500 invoice records/200 history entries with an explicit truncation notice. Full administrative audit records remain in the database.
- Application code does not implement live payments, platform payouts, seller onboarding, automatic invoice replacement, or refund/cancel initiation. Those are not claimed as completed features.

## SECTION H — END-TO-END PAYMENT STATUS

**IMPLEMENTED BUT NOT FULLY VERIFIED.**

The repository contains a direct-merchant Sandbox invoice workflow with fail-closed configuration/ownership checks, approved-milestone SQL authorization, durable deduplication, verified webhooks, authoritative reconciliation, diagnostics and existing-design UI integration. Actual ability to complete a real Sandbox payment is **not established**. Merchant configuration, webhook registration, database deployment, Node/build/tests and a genuine Sandbox end-to-end payment must be completed before describing this as fully verified or ready for real payments.
