# One-project pilot

Target: one client, one freelancer, one website project and one milestone, from
invitation through a payment confirmed by PayPal Sandbox.

## Implemented locally

- Authentication: inline validation, accessible password visibility, Caps Lock
  feedback, eight-character minimum for new passwords, preserved input and
  duplicate-submission protection.
- `/demo`: the existing workspace sidebar, a six-stage guided project, measurable
  agreement criteria, evidence metadata, immutable submission revisions, scripted
  verification, explicit client approval and a separate local PayPal simulation.
  The original freeform local workspace and its storage key remain available.
- Real workspace: project and dashboard next actions derived from project
  membership, current agreement acceptance, active handoff links and latest
  milestone revisions. Archived projects and unavailable records do not invite
  new workflow actions.
- Delivery: automated checks are explicitly `CANNOT_VERIFY` while unconnected.
  Submission notes remain in the form after upload failures. Approval does not
  imply an invoice or payment.

## Next acceptance gate: two-account test

Use a designated test environment and two verified test accounts. Do not rerun
migrations 001–003 on the existing database.

1. Client creates a website project with a $1,200 budget and invites the second
   account. The freelancer accepts through Invitations.
2. Client creates one milestone with observable criteria: Home, Product and
   Contact pages; mobile navigation opens at 375 px; contact form confirmation;
   source code delivered.
3. Both accounts accept the same agreement version. Before both accept, a
   submission must remain unavailable.
4. Client creates a submission link. Confirm the assigned freelancer can open
   it and an unrelated account cannot read or submit through it.
5. Freelancer submits a URL, source archive and delivery notes. Simulate a failed
   upload and verify that notes remain and a retry does not duplicate a completed
   submission.
6. Client requests a specific change. Freelancer submits revision 2. Confirm
   revision 1 and its review remain unchanged.
7. Client reviews every criterion and approves revision 2. Confirm the project
   shows approval, with no fabricated payment.
8. Create an agreement v2 and verify that prior acceptance does not authorize
   delivery under the changed requirements. Check expired/revoked links as well.

## Integration order after the acceptance gate

1. **Gemini draft:** server-only API call, authorized project client, bounded and
   schema-validated response. The result is an editable draft. It cannot approve
   an agreement or silently modify an accepted version.
2. **Website checks:** persist explicit check definitions with the agreement,
   run only supported measurable checks on a submitted revision, and store
   result plus evidence. Unavailable, ambiguous or unsupported checks return
   `CANNOT_VERIFY`. Network targets need public-URL validation, redirect checks,
   timeouts and access controls. Never infer a pass from the mere presence of a
   URL or file.
3. **PayPal Sandbox:** authorize the project client, bind one invoice to one
   approved milestone, make creation idempotent, and verify payment server-side.
   A click, redirect or webhook event name alone cannot set `Paid`. Signature
   verification, authoritative invoice/payment details, currency, amount and
   recipient must all match. The pilot merchant/recipient account must be
   explicitly identified before wiring the payment flow.
4. Additive database migrations, reviewable before application, must enforce
   membership, immutable revision/report history, invoice uniqueness and
   server-controlled payment status.

The local environment contains server credential variable names, but this work
does not establish their validity or connect these services. No live database
mutation, external AI request, browser verification or PayPal transaction was
performed.

Relevant primary references:

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Browserless connections](https://docs.browserless.io/examples/playwright-connection)
- [PayPal invoice webhooks](https://developer.paypal.com/platforms/invoicing/reference/invoicing-webhooks/)
- [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/)

## Validation for this change

- Project TypeScript check: passed with the installed native TypeScript compiler
  (`node_modules/@typescript/typescript-win32-x64/lib/tsc.exe --noEmit`).
- 25 existing/new regression cases: passed after TypeScript compilation, using
  the available JavaScript runtime to execute their assertions. Coverage includes
  auth validation, membership, agreement versions, evidence, demo revisions,
  approval/payment separation and workflow next actions.
- Modified TS/TSX/CSS files: parsed and formatted with the installed standalone
  Prettier plugins.
- Standard `npm test`, `npm run build` and `npm run typecheck`: attempted; the
  shell cannot resolve Node/npm. The available native compiler provided the
  typecheck fallback above. The production build remains unverified.
- Lint: there is no lint script, ESLint dependency or ESLint configuration.
- Browser visual/mobile QA and the two-account live acceptance gate remain
  pending; no browser surface was available in this session.
- Temporary compiled regression files remain in ignored `.validation/`; automatic
  approval policy rejected recursive cleanup. They are not application source.

## Changed source files

| Area | Files |
| --- | --- |
| Authentication | `src/components/auth-form.tsx`, `src/components/password-field.tsx`, `src/components/ui.tsx`, `src/lib/auth-validation.ts` |
| Guided demo | `src/components/demo.tsx`, `src/components/demo-walkthrough.tsx`, `src/lib/demo-workflow.ts`, `src/app/demo/page.tsx`, `src/app/demo/demo.css` |
| Real project flow | `src/lib/project-workflow.ts`, `src/components/project-next-step.tsx`, `src/components/projects.tsx`, `src/components/agreement.tsx`, `src/components/delivery.tsx` |
| Shared styling | `src/app/globals.css` |
| Regression tests | `tests/auth.test.ts`, `tests/demo.test.ts`, `tests/workflow.test.ts` |
| Documentation / generated-file exclusion | `WORKFLOW-PILOT.md`, `.gitignore` |
