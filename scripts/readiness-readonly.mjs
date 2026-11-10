import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
const env = process.env;
const timedFetch = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const tables = ['projects','project_members','profiles','project_invitations','agreements','milestones','acceptance_criteria','agreement_approvals','submission_links','evidence_submissions','evidence_artifacts','submission_reviews','payments','payment_history','paypal_webhook_events'];
const rows = {};
for (const table of tables) {
  const result = await admin.from(table).select('*', { count: 'exact' }).limit(1000);
  rows[table] = result.data || [];
  console.log(JSON.stringify({ table, count: result.count, errorCode: result.error?.code || null }));
}
const { data: identities, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const users = identities?.users || [];
const judge = users.filter(u => /judge/i.test(JSON.stringify([u.email,u.user_metadata])));
console.log(JSON.stringify({ authRead: authError ? 'BLOCKED' : 'PASS', returnedAccounts: users.length,
  confirmedAccounts: users.filter(u=>u.email_confirmed_at).length,
  judgeAccounts: judge.length, judgeMemberships: judge.map(u=>rows.project_members.filter(m=>m.user_id===u.id).map(m=>m.role)),
  merchantIdentityExists: users.some(u=>u.id===env.PAYPAL_FREELANCER_USER_ID),
  merchantRoles: rows.project_members.filter(m=>m.user_id===env.PAYPAL_FREELANCER_USER_ID).map(m=>m.role) }));
const binding = await admin.from('paypal_merchant_bindings').select('*').limit(100);
console.log(JSON.stringify({ merchantBindingMatches: binding.data?.some(b=>b.active && b.verified_at && b.freelancer_id===env.PAYPAL_FREELANCER_USER_ID && b.merchant_id===env.PAYPAL_MERCHANT_ID && b.merchant_email===env.PAYPAL_MERCHANT_EMAIL?.toLowerCase() && b.credential_fingerprint===createHash('sha256').update(env.PAYPAL_CLIENT_ID?.trim() || '').digest('hex')) || false }));
const bucket = await admin.storage.getBucket('proofpay-evidence');
console.log(JSON.stringify({ evidenceBucketPrivate: bucket.data?.public === false, sizeLimit: bucket.data?.file_size_limit }));
for (const table of ['projects','project_members','evidence_artifacts','payments','paypal_merchant_bindings','paypal_webhook_events']) {
  const r = await anon.from(table).select('*').limit(1);
  console.log(JSON.stringify({ anonymous: table, status: r.status, errorCode: r.error?.code || null, rows: r.data?.length }));
}
const schema = await timedFetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/', {headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+env.SUPABASE_SECRET_KEY,Accept:'application/openapi+json'}});
const api = schema.ok ? await schema.json() : {};
console.log(JSON.stringify({ restSchemaStatus: schema.status, rpcNames: Object.keys(api.paths || {}).filter(p=>p.startsWith('/rpc/')).sort(), exactSqlDefinitions: 'BLOCKED: no SQL connection available through REST' }));
