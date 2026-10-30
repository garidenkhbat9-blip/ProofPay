# ProofPay development rules

- Read README.md before changing the implementation. Preserve the approved white Quiet Precision design and readable typography.
- This is native Next.js App Router + TypeScript. Keep UI in React components; do not add a legacy JavaScript application renderer or replace the app with a mock.
- Keep product copy and identifiers in English. Explain changes to the owner in clear Mongolian.
- Keep project roles independent of the selected perspective. Supabase membership/RLS/RPC checks are authoritative.
- Keep agreements and submitted evidence versioned and immutable. Approval is not payment.
- Do not rerun migrations against the existing database. New schema changes need new additive migrations.
- Do not embed private API keys in client components or NEXT_PUBLIC variables. Public publishable Supabase keys are allowed.
- AI must not invent verification evidence or independently approve/pay work. Unimplemented integrations must remain explicitly unconnected.
- Preserve the existing Sites deployment; this directory is the downloadable Next.js edition.
- Run npm run typecheck, npm test, and npm run build after substantive changes. Report actual checks and limitations. Two-account live RLS/upload tests and browser visual QA remain pending.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
