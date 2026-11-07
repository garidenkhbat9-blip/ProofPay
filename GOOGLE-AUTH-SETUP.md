# Google OAuth — configuration and verification

## Implementation checkpoint — 2026-11-07

- `npm run typecheck`: PASS.
- `npm test`: 144/144 PASS, zero failures/skips. Includes actual SSR SDK cookie/verifier exchange with mocked provider, actual initiation/callback route tests for origin, duplicate attempts, cancellation, replay, invalid code, unverified identity and profile failure, plus existing account/permission/payment tests.
- Existing Chrome component suite: 15 scenarios PASS (46 desktop, 47 mobile, 47 narrow assertions). Google consent UI and the new onboarding page were not visually tested against live Google.
- `npm run build`: PASS, 28/28 static pages, all three new auth routes included.
- `git diff --check`: PASS. No migrations executed or modified; no live Google/email/payment requests or deployment performed.

Changed files: `package.json`, `package-lock.json`, `src/lib/supabase.ts`, `src/lib/google-auth.ts`, `src/lib/server/oauth.ts`, `src/app/auth/google/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/workspace/page.tsx`, `src/components/google-sign-in.tsx`, `src/components/auth-form.tsx`, `tests/google-auth.test.ts`, `tests/google-callback.test.ts`, `tests/support/oauth-cookies.mjs`, `README.md`, this file.

The new cookie storage name `proofpay-auth-v2` also isolates its cross-tab authentication events from old localStorage clients. Do not import old token storage or use it as a fallback. This change intentionally requires a fresh login after upgrading.

## Architecture

ProofPay previously used browser-only localStorage sessions. It now uses `@supabase/ssr` 0.12.7 shared cookies. POST `/auth/google` calls `signInWithOAuth(provider: google)` using a server PKCE client and writes its verifier cookies. Google returns through Supabase to GET `/auth/callback`; that route validates the attempt cookie, exchanges the code, verifies the returned user through Auth, checks confirmed email and loads their profile under their RLS context. Redirects are fixed to a workspace/onboarding path. No fallback to a previous session occurs on failure.

The existing browser provider reads these cookies and continues its account-scoped loading, refresh and sign-out behavior. No service-role key, middleware authorization bypass or automatic migration is added. Existing bearer-authorized APIs stay unchanged. Old localStorage sessions are intentionally not imported; users sign in again once after the upgrade. Email/password now also stores sessions in cookies. The explicit token_hash confirmation template from AUTH-FLOW-STATUS.md remains required; PKCE password-reset links must be opened in the browser that requested them. Existing email-confirmation settings must remain enabled.

Google-confirmed email is checked server-side and is never sent through ProofPay signup/resend. Existing database trigger creates profiles once; the callback only reads them. Missing profiles produce an actionable error instead of a privileged insert. New users without a saved preference choose Client/Freelancer; selection updates only their Auth metadata, never membership. Returning users with a saved preference skip the choice. Supabase handles verified identity linking; this app does not merge accounts or link by arbitrary email.

## Exact manual configuration (owner action; not performed)

1. **Google Cloud → APIs & Services → OAuth consent screen:** configure the ProofPay app and support contact. Add the Google accounts used by judges/testers while the consent screen is in Testing, or complete Google's publishing requirements. Request only basic OpenID/profile/email scopes. Add authorized domains as required by Google's console for the app/Supabase configuration.
2. **Credentials → Create OAuth client ID → Web application.** Authorized JavaScript origins: `https://proof-pay-beta.vercel.app` and `http://localhost:3000`.
3. **Google Authorized redirect URI:** copy the exact callback displayed by **Supabase Dashboard → Authentication → Sign In / Providers → Google**. For the Supabase project documented in this repository it is `https://gsrnpbwsdwcpkjvomcwf.supabase.co/auth/v1/callback`. Confirm the deployed project's reference matches before saving. This is the Google-to-Supabase callback; do not substitute ProofPay's `/auth/callback` here.
4. **Supabase Google provider:** enable Google and paste the Google client ID/client secret into the dashboard. Keep secrets out of Next public variables, source, logs and browser code. Leave email/password confirmation enabled. Do not change RLS or verified_email().
5. **Supabase URL Configuration:** Site URL `https://proof-pay-beta.vercel.app`. Add redirect allowlist entries `https://proof-pay-beta.vercel.app/auth/callback?attempt=*` and `http://localhost:3000/auth/callback?attempt=*` (the app appends a random attempt ID). Keep existing `/auth/confirm`, login and password-reset entries. Do not allow arbitrary external origins or all Vercel previews.
6. **Vercel → Environment Variables:** the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must point to that same Supabase project in Production. Google secret belongs only in Supabase. No service-role or Google secret is required by these new routes. A later owner-approved deployment is needed; none was performed here.

Reference: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Failure behavior and limitations

The Google account picker is explicitly requested. UI prevents overlapping email/Google submits, and a ten-minute HttpOnly attempt cookie prevents repeated OAuth starts across tabs. Cancelled, missing, invalid, expired or replayed callbacks cannot open the old workspace. If the browser closes the Google flow without returning, wait ten minutes for the attempt cookie to expire. Request/code/session/cookie secrets are never logged. Cookies use Secure on HTTPS and SameSite defaults compatible with the OAuth return.

Missing/disabled Google provider may show a Supabase provider error before control returns to ProofPay; configure the provider before presenting the button to judges. Successful SDK URL creation alone does not establish that Google credentials are configured. No remote Auth settings or provider credentials were inspected or modified. Email rate limits remain in effect; Google is a separate authentication option, not a bypass for email signup limits.

## Two-account manual test

1. Use two separate browser profiles A/B. In A choose Google account A on Sign In; confirm the displayed email, saved workspace and existing projects.
2. In B choose a new Google account B on Sign Up. Choose Freelancer once. Check that no extra confirmation email is requested and no client projects from A are visible.
3. Invite B's verified Google email from A. B should see only matching invitations and gain membership only after accepting.
4. Sign B out and back in: onboarding should not repeat. Refresh the workspace to verify cookie persistence.
5. In A explicitly choose Google account B: the callback must establish B's session, clear A's workspace snapshot and load only B's records. Same-profile tabs share cookies; separate profiles remain isolated.
6. Cancel Google, replay a callback, remove the verifier cookie, and use an expired code. Each must fail safely with a fresh sign-in path. Test an existing email/password account with its verified Google identity using Supabase's configured identity-linking behavior.
7. Regression-check email/password login, token_hash confirmation, same-browser password reset, sign-out, archive permissions, agreement acceptance and payment visibility. Do not create invoices or make payments for this auth test.

Hackathon readiness is conditional on dashboard configuration, an approved deployment and this real two-account smoke test. Local tests cannot establish Google consent screen eligibility or hosted provider configuration.
