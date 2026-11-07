# Single workspace selection after Google OAuth

## Root cause and behavior

Explore carried perspective in the login `next` URL, and signup held it in React state. GoogleAuthButton sent neither to the OAuth start route. The callback only read existing Auth user metadata, so new users were routed to another workspace choice.

The shared Google button now sends the validated UI intent. The same-origin POST creates an HttpOnly, SameSite=Lax cookie (Secure on production) with the random auth-attempt ID, optional perspective and a 10-minute expiry. The callback checks that context before exchanging the PKCE code. Supabase OAuth state and verifier cookies are unchanged. Context is deleted on success or failure. Invalid, absent, expired or mismatched context requires a fresh sign-in; an attempt already in progress remains blocked for up to ten minutes.

After exchange, getUser verifies the actual identity and confirmed email, then the existing profile is loaded under that session. Explicit intent wins over an old preference and is persisted in the authenticated user's `user_metadata.preferred_workspace`. No profile or project membership is inserted. Without intent, the current account's persisted preference is used. Only a user with neither sees the compact one-time selection. The page revalidates identity and skips itself if a preference already exists.

Account > Workspace view saves a preference for future Google logins. Browser-side preference writes use the captured, server-verified account token so a concurrent account switch cannot write to the other account. A subsequent identity check blocks navigation if the session changed. Perspective remains presentation only; verified email, invitation and per-project authorization rules are unchanged. The existing per-user browser view cache remains for local navigation; Google callback destinations explicitly synchronize the selected view.

No schema migration, OAuth provider setting, new environment secret or redirect path is required. Existing Google setup in GOOGLE-AUTH-SETUP.md remains necessary. A Google attempt begun before this change must be restarted because it lacks the new context cookie. Browser cookies must be enabled, and callback must return to the same browser where PKCE started.

## Changed files

- src/lib/google-auth.ts; src/lib/workspace-preference.ts
- src/app/auth/google/route.ts; src/app/auth/callback/route.ts; src/app/auth/workspace/page.tsx
- src/components/google-sign-in.tsx; src/components/auth-form.tsx; src/components/account.tsx
- src/app/explore/page.tsx; src/app/precision.css
- tests/google-callback.test.ts; tests/workspace-preference.test.ts; tests/navigation.test.ts
- tests/browser/client-experience.js; tests/browser/client-components.test.mjs; scripts/preview-client-experience.ps1
- README.md; WORKSPACE-OAUTH-FLOW.md

## Verification

- npm run typecheck: passed.
- npm test: 150 passed, 0 failed, 0 skipped. Includes real Supabase SDK/route tests with isolated network/cookie fixtures and Chrome rendering of real components with mocked auth/data.
- Browser harness: 27 desktop/mobile scenarios, including 320px onboarding, Client/Freelancer intent transmission, role selected state, disabled/loading/error states, duplicate-click protection, and existing workspace/tour regression checks. Screenshots in .validation/client-experience. Mobile and desktop onboarding screenshots reviewed.
- npm run build: passed, 28 static pages generated.
- Initial test runs caught an obsolete copy assertion and a 320px overflow; both were corrected before the final passing run.
- No real Google authorization, confirmation email, live RLS/upload test or financial transaction was performed. Existing invitation/membership/email auth tests passed; this is not evidence of a production OAuth end-to-end run.

## Manual verification in two separate browser profiles

1. Profile A: /explore > Client > Google account A. Expect Client dashboard, no second workspace choice. Profile B: Freelancer > account B. Expect Freelancer dashboard.
2. Repeat signup with each selected role. Log out and use plain Google Sign In without a next parameter; each account should return to its own saved view.
3. Use a new Google account from plain /login. Choose once, Continue, refresh and sign in again. Onboarding should not repeat.
4. Account > Workspace view: switch, then log out and log in again. Verify the persisted view. Confirm project permissions and membership rows did not change.
5. Open an invitation addressed to the verified freelancer email; confirm visibility/acceptance follows existing permissions. Try another account and an unauthorized project URL; access must remain blocked.
6. Cancel Google, replay a consumed callback, and leave an attempt for more than ten minutes. Expect a fresh sign-in requirement, never an unrelated account as fallback.
7. Confirm existing email/password login and confirmation still work. Run production-origin and localhost tests independently; their cookies are separate.
