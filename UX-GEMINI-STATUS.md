# UX clarity and Gemini reliability — 2026-11-09

**LOCALLY FIXED, LIVE PROVIDER UNVERIFIED.** This is a controlled refinement of the existing application, not a redesign. Prior OTP/reviewer/launch changes remain intact. No migrations, production records, invoice operations, deployment or Git publication.

## Implemented UX changes

- Project setup: the top **Create agreement draft** now opens the existing editor directly when a freelancer is assigned and no agreement exists. The lower duplicate action is removed in that state. The editor still enforces actual client membership, archive status and current records. Without a freelancer, Invite stays primary and preparing a draft remains a separate secondary operation. Historical/version pages keep their navigation and editing rules.
- Removed repeated “Not prepared” / embedded “No agreement yet” status presentation. The next-action area owns the status. Other-milestone, history and waiting-record links remain when they navigate somewhere different; they are not indiscriminately hidden.
- Phase names now read **Agreement → Delivery → Review → Payments**. Review is a human decision, not an AI completion state. Existing phase IDs/state transitions/permissions are unchanged.
- Client overview no longer repeats the same review URL in both its primary action and a separate AI aside. If the AI suggestion targets different work, it remains available.
- Payments/Earnings lead with **Paid · confirmed by PayPal** and **Open invoices · awaiting payment confirmation**. Planned budget, approved work and invoiced face values are in a collapsed breakdown. No stored amounts changed. Open totals are full invoice face values, explicitly not outstanding balances; paid totals exclude refunds/unconfirmed records. Unknown/error/truncated records show unavailable totals rather than zero. Totals use integer minor-unit addition and actual membership-filtered rows.
- “Ready for Payment” before invoice creation becomes **Approved · invoice not created** / **Work approved · no invoice**. Draft invoices say **Draft invoice · not sent**. The existing verified PAID checks are unchanged.
- Payment empty-state copy is shorter; its repeated warning is removed when no invoices exist. Settings explains account/project access in user language while retaining its actual controls.

## Surface review and preserved distinct actions

| Surface | Finding / disposition |
| --- | --- |
| Landing / Explore | Get started vs How it works have distinct destinations. Perspective cards lead to authentication, not account impersonation. Preserved design and links. |
| Password / Google / OTP / signup / recovery | Different authentication operations, not duplicates. Existing-session acknowledgment and safe return paths retained. |
| Client overview | Consolidated duplicate same-work review CTA; retained project creation, filters, invitations and other-work suggestions. |
| Client projects / Freelancer jobs | Search/category/archive filters and membership-specific next actions remain; planned values do not become earnings. |
| Project details / milestones | Consolidated agreement creation and status; kept other-milestone navigation, per-project role, history and archive safeguards. |
| Invitations | Accept, revoke and manage recipient are distinct authorized operations. No fake email/reminder controls added. |
| Agreement creation / acceptance | Existing draft editor, AI suggestions, manual entry, version creation and mutual acceptance remain distinct. |
| Evidence submission | Draft/resume/finalize/revise have different immutable-revision effects; preserved. |
| AI Review / human approval | Three-column evidence workspace preserved. AI never checks criteria or invokes review/payment mutations. Request changes vs approve remain separate human decisions. |
| Payments / Earnings | Real invoice and verified money separated from planning, approval and simulation. Merchant authorization/checkout controls unchanged. |
| Activity / history | Agreement/submission/review events and historical links retained; no synthetic activity added. |
| Settings | Simplified technical connection explanation; identity, workspace preference and sign-out remain. |

This review is source plus isolated browser-fixture QA, not a live click-through of every hosted account state.

## Gemini chain and concrete fixes

Both features use direct REST, not a Gemini SDK:

- Agreement: `AgreementDraftBuilder` → authenticated client-only `/api/projects/[id]/agreement-draft` → `generateAgreementDraft` → `generateStructured`. Node runtime, route max 60 seconds, provider limit 45 seconds; website-only, validated scope and structured draft parser.
- Evidence: `EvidenceAiReview` → authenticated client-only `/api/projects/[id]/submissions/[submissionId]/ai-review` → caller-RLS evidence loader → `generateStructured`. Node runtime, route max 120 seconds, overall analysis limit 100 seconds, provider limit 45 seconds; context is rechecked after generation.
- Environment: server-only `GEMINI_API_KEY`, optional `GEMINI_MODEL`; default remains **gemini-3.8-flash**. Endpoint remains `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, with `x-goog-api-key`, `systemInstruction`, `contents` and structured JSON `generationConfig.responseFormat`. No unsupported model substitution or payload rewrite was justified by evidence.
- Existing 512 KB request cap, bounded response/body/text reads, 6,000 output-token ceiling, strict parsers, no automatic retries, client duplicate guards and server process request gates remain. Process gates are not represented as distributed quota enforcement.

Confirmed local reliability fixes: all provider errors previously shared misleading key/model guidance, and provider safeguards looked like malformed output. Messages now distinguish actual HTTP 400/401/403/404/429/503, allowlisted explicit invalid/expired-key reasons, content safeguards, invalid output, cancellation, network failure and application timeout. Explicit transport `TimeoutError` now classifies as TIMEOUT rather than NETWORK. Allowlisted DNS/socket reason codes may be logged without raw errors, hostnames or URLs. Server diagnostics contain only model, phase, safe category/enums, byte size and latency; no prompts, evidence, tokens or keys.

AI Review now explains loading and handles browser transport/non-JSON server failures with useful, non-technical unavailable messages. Human review stays available. Errors never produce fake findings.

## Bounded real request: actual result

Ran `scripts/gemini-contract-check.ts` once with the locally configured key and existing default model. Its first harmless structured request was **323 bytes**; it failed in **about 77 ms**, before response headers, with `kind: NETWORK`, `phase: headers`. **No provider HTTP status or generated content was received.** The script stopped immediately; agreement/evidence live contract requests were not attempted and no retries were made. `.validation/ux-gemini-live.log` records the sanitized result.

This is an external connectivity limitation for this execution environment, not proof that Gemini is down. It also does not establish why the earlier, different request stalled for 45 seconds. Key validity, model permission for this project, Free Tier quota, billing requirements and the deployed Vercel network/configuration remain unknown. No HTTP 429/503, invalid-key rejection or billing denial was observed. A model being documented is not proof of access by this key.

The diagnostic script runs the real minimal request, then actual agreement and evidence prompt/schema/parser contracts with synthetic data **only after each preceding stage succeeds**. It makes at most three sequential requests, stops at the first failure, and never reads private projects or prints model output. Do not repeatedly run it while the same network failure persists.

Evidence capabilities remain accurate: submission notes plus up to four bounded UTF-8 TXT/MD/CSV/JSON files (32 KB/file, 64K total source characters). PNG/images, PDFs, HTML and external/Figma URLs are not content-inspected. Their metadata/unavailable status remains visible. Exact source references/quotes, criterion IDs, revision binding, limitations and advisory-only status remain enforced.

Official references consulted: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest), [generateContent reference](https://ai.google.dev/api/generate-content?hl=en), [documented model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Vercel environment variables](https://vercel.com/docs/environment-variables). Vercel variable changes apply to new deployments, not already-running releases. No owner dashboard or deployed settings were accessed.

## QA and owner follow-through

Final results: **222 passed, 0 failed, 0 skipped**, including **93 browser scenarios**; TypeScript passed before tests and after restoring the build-generated declaration file. Production build passed, **29/29** static pages. Initial targeted suite: 49 passed; final focused Gemini/payment-summary suite: 14 passed. Seven added unit cases and four added browser scenarios explain the baseline difference. During iteration the multi-milestone navigation regression was corrected, and the new editor test was corrected to select the native `dialog[open]`; final tests verify the actual editor opens. No assertions were removed to conceal failures.

Artifacts: `.validation/ux-targeted.log`, `ux-targeted-final.log`, `ux-final-tests.log`, `ux-build.log`, `ux-gemini-live.log`; `.validation/client-experience/component-results.json`. Reviewed desktop/mobile agreement and mobile payment screenshots; mobile inspection prompted moving the sole draft action to the top. Final screenshot: `workspace-agreement-mobile.png`; also `workspace-agreement-desktop.png`, `payments-mobile.png`, `payments-desktop.png`. Browser scenarios cover 320/390/768/1024/1440px, keyboard/focus, loading, failure, history and role separation. Fixtures do not prove hosted Auth, actual Gemini generation or a PayPal transaction.

Changed in this task: `components/{project-workspace,agreement,client-overview,payments,account,evidence-ai-review}.tsx`, `lib/{project-workspace,gemini,payment-summary}.ts`, payment display labels only in `lib/payments/model.ts`, Gemini/payment-summary/browser tests, preview module list, synthetic `scripts/gemini-contract-check.ts`, and this report. PayPal gateway/workflow/webhook/server authorization, migrations, provider/session implementation, credentials, styles and dependencies are unchanged. Existing reviewer-access work remains separate and preserved.

Baseline was the preceding executed **215-test / 89-browser-scenario** run, not the obsolete 113-test report. New cases cover financial distinctions/unavailable totals, safe Gemini error categories, explicit key rejection, content safeguards, loading/duplicate requests, top agreement editor action, mobile payments and removal of same-work overview duplication. Existing auth/OAuth/OTP, permissions, unsupported evidence, human review, provider verification and payment regressions remain included.

Owner steps: (1) Vercel project → Settings → Environment Variables: verify server-only `GEMINI_API_KEY` and intended `GEMINI_MODEL` in the actual deployment environment; never paste values into a report. (2) After authorizing the reviewed code release, deploy that release; a variable-only change also requires redeployment. (3) Run one synthetic contract diagnostic from a network that can reach Gemini, or one authorized app action while viewing Vercel Logs filtered to `proofpay-gemini`; use the actual safe status/category to decide whether Google AI Studio key permissions or rate limits need attention. Do not enable billing or change models on speculation.
