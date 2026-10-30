# ProofPay stabilization — 2026-10-29

Code fixes are in place, but runtime acceptance is **blocked**, not passed. Do not treat this checkout as verified ready for payment integration until the checks below pass.

## Environment findings

- The application root is `C:\Users\DELL\Downloads\ProofPay-NextJS-16.4.2\proofpay-next`, one directory below the initial workspace.
- This is an extracted checkout without Git metadata. A pre-edit source/test snapshot and hashes are in `.validation/stabilization-before/` (TypeScript copies have `.snapshot` extensions).
- `node_modules` is present. All 14 direct dependency/devDependency versions match `package.json`; the lockfile is version 3. This verifies versions, not every transitive file's integrity.
- `Get-Command node,npm` finds neither command in this execution environment. PATH includes `C:\nvm4w\nodejs`, a symlink to `C:\Users\DELL\AppData\Local\nvm\v24.7.0`. Reading that target returns **Access is denied**. This establishes an access problem here; it does not establish that Node is uninstalled on the host.
- A separate portable runtime download from nodejs.org failed with “Unable to connect to the remote server.” No runtime or dependency upgrade was installed; machine PATH and NVM configuration were not changed.
- Environment files were not printed or overwritten.

## Confirmed defects addressed

1. **Dashboard counts:** previously included submissions belonging to superseded agreement milestones. Counts now use the latest agreement for each visible project and the latest non-draft submission per milestone.
2. **Agreement navigation and concurrency:** saving from a version-specific URL now navigates to the saved version. Missing-version pages link back to the latest version. An open acceptance dialog keeps its selected agreement. An open draft keeps its original base version, including when another tab creates the first agreement; the existing database conflict check still rejects stale saves.
3. **Evidence URL mismatch:** URL parsing accepted uppercase schemes while the database requires lowercase `http://` or `https://`; the UI previously sent the original string. Submission now sends the normalized URL, validates its stored length, and rejects incomplete scheme syntax before upload.
4. **Misleading migration errors:** loading errors no longer tell users to apply old migrations. The actual error and access/setup guidance are shown; schema reference downloads remain available. No migration was created or applied.
5. **Account perspective isolation:** preferences use a user-ID-specific storage key with signup metadata fallback. The old global preference is ignored, and signup no longer writes to it. Switching perspective still grants no database permissions.
6. **Session/data races:** an older initial session lookup cannot replace a newer auth event. Account changes invalidate old data loads and reset account state. The workspace subtree is keyed by account so form state does not carry between accounts.
7. **Synchronization and form retention:** visible, online workspace tabs poll every 30 seconds and refresh on focus, visibility restoration, or reconnect. Background triggers share in-flight work and have a five-second cooldown. A mutation arriving during a read queues one fresh read afterward. Hidden/offline tabs do not start automatic reads. Initial loading remains separate from background refresh, so ordinary refreshes and transient failures preserve mounted forms and the last successful snapshot.
8. **Partial cloud snapshots:** network, authentication, and permission failures in optional tables now reject the load instead of silently replacing parts of a workflow with empty arrays. Only missing optional schema (`42P01`, `PGRST205`) remains degradable. Failed refreshes show an error alongside the previous snapshot; database authorization remains authoritative for actions.
9. **Evidence retry after lost response:** the original flow restarted `begin_evidence_submission` after an uncertain finalization. SQL rejects that restart if the prior submission committed. The form now retains and retries the original finalization ID and payload, using the existing idempotent `submit_evidence` behavior. Confirmed finalization is not sent again if only the subsequent refresh fails. Inputs remain fixed while confirming that submission.

## Files changed

| File | Purpose |
| --- | --- |
| `src/components/provider.tsx` | Account/session isolation, refresh lifecycle, retained snapshots |
| `src/components/workspace-shell.tsx` | Visible/online synchronization, mounted forms, account boundary |
| `src/components/auth-form.tsx` | Remove global perspective write |
| `src/components/projects.tsx` | Correct dashboard counts |
| `src/components/agreement.tsx` | Version navigation, fixed draft/acceptance targets, accurate errors |
| `src/components/delivery.tsx` | URL normalization, accurate errors, safe evidence confirmation retry |
| `src/lib/cloud.ts` | Reject partial snapshots caused by transient/permission failures |
| `src/lib/domain.ts` | Current milestone selector and normalized URL validation |
| `src/lib/workspace-sync.ts` (new) | Coalesced refresh queue and account preference helpers |
| `src/lib/evidence-submit.ts` (new) | Retained evidence finalization snapshot |
| `tests/cloud.test.ts` | Transient and permission failure regression |
| `tests/domain.test.ts` | Dashboard and URL regressions |
| `tests/workspace-sync.test.ts` (new) | Coalescing, cooldown, queued mutation read, disposal, retries, account preference |
| `tests/evidence-submit.test.ts` (new) | Lost response and post-commit refresh failure regressions |
| `STABILIZATION.md` (new) | Findings, validation limits, handoff checklist |

No changes to `package.json`, `package-lock.json`, existing migrations, CSS, demo, payment logic, or branding assets. Existing database records and accepted agreements were not modified.

## Validation actually performed

| Check | Result |
| --- | --- |
| Correct application directory and direct dependency versions | Passed |
| `npm run typecheck` | Attempted; command could not start because npm is unavailable |
| `npm test` | Attempted; command could not start because npm is unavailable |
| `npm run build` | Attempted; command could not start because npm is unavailable |
| esbuild syntax transforms of all source/test TS/TSX files | 67 files passed, zero syntax errors |
| New regression tests | 10 added; 43 total test cases, **not executed** in Node |
| Supplemental headless browser test attempt | Browser exited without producing test results; no pass claimed |
| Source/hash review | Existing migrations, CSS and dependency manifests unchanged |
| Live Supabase/RLS/storage and visual QA | Not performed |

Syntax transforms do not check TypeScript types, React behavior, production bundling, or actual database policies. The added unit tests use mocked clients where appropriate and do not substitute for live RLS testing.

## Remaining verification and limitations

1. Make Node 22+ and npm readable in the execution environment (or provide a portable runtime under `.tools`). From the application directory run:

   ```powershell
   node --version
   npm --version
   npm run typecheck
   npm test
   npm run build
   npm start
   ```

   Do not reinstall or upgrade dependencies merely to work around the inaccessible runtime. Do not overwrite `.env.local`.

2. In two separate browser profiles, exercise client creation → freelancer invitation/acceptance → versioned agreement and mutual acceptance → URL/file evidence → changes requested → revised evidence → approval. Confirm the peer sees updates within one polling interval plus request time, and promptly after returning to the tab.
3. While typing in project, invitation, agreement, evidence, and review forms, trigger a refresh from another tab; confirm unsaved input survives. Simulate a network failure and recovery. Verify an old agreement draft cannot silently save against a newer base. Verify history/back/forward and saving from a `?version=` URL.
4. Switch between two accounts in the same browser. Confirm perspective, loaded data, modal state, and unsaved input do not leak. Verify direct-link sign-in, persisted sessions, sign-out, confirmation emails, and password reset against the deployment's allowed redirect URLs.
5. Use a third unrelated account and an anonymous session to verify project/table reads, RPC authorization, and private-file downloads are denied. Verify revoked/expired links reject submissions while saved evidence remains reviewable. Local SQL contains membership/RLS and RPC guards, but the live database's installed policies/migration state were not independently verified.
6. Simulate a lost response after evidence commit and retry in the same open form. Confirm one immutable submission, no repeated upload, and the original notes/artifacts. Retry state is component-local; reload/navigation loses it. A refresh should reveal a committed submission after reconnection.
7. Other creation RPCs (`create_project`, `invite_freelancer`, `create_submission_link`) have no caller-supplied idempotency key in the included SQL. Ambiguous-response retries need live fault-injection verification before designing a forward-only database change. The installed PostgREST SDK retries only idempotent HTTP methods, not these mutation POSTs; no automatic mutation-retry defect was found there.
8. Perform visual QA at desktop/mobile sizes. No CSS/layout redesign was made. PayPal and payment behavior remain untouched.
