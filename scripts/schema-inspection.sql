select n.nspname as schema, p.proname as function, pg_get_functiondef(p.oid) as definition,
       p.prosecdef as security_definer, p.proconfig as configuration,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='proofpay_private') or (n.nspname='public' and p.proname in
 ('create_project','invite_freelancer','accept_project_invitation','revoke_project_invitation',
  'create_agreement_version','approve_agreement_version','create_submission_link','revoke_submission_link',
  'begin_evidence_submission','submit_evidence','review_evidence','prepare_paypal_payment',
  'claim_paypal_payment','attach_paypal_invoice','finish_paypal_payment','fail_paypal_payment'))
order by n.nspname,p.proname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role')
order by table_schema,table_name,grantee,privilege_type;

select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name='payments' and grantee in ('anon','authenticated')
order by column_name,grantee,privilege_type;

select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;
