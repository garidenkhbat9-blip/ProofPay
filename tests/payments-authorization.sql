-- Run only on a DISPOSABLE/local Supabase database after migrations 001-004.
-- psql -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f tests/payments-authorization.sql
-- All test rows are rolled back. Never point this at the production database.
begin;
do $$
declare c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
 l uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); criterion uuid:=gen_random_uuid();
 result public.payments%rowtype; again public.payments%rowtype; lease uuid:=gen_random_uuid(); claimed jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (c,c::text||'@example.test',now(),'{}'),(f,f::text||'@example.test',now(),'{}'),(outsider,outsider::text||'@example.test',now(),'{}');
 insert into public.projects(id,created_by,title,description,work_category,budget_amount,currency,status)
 values(p,c,'Payment authorization test','Disposable test','website',100,'USD','active');
 insert into public.project_members(project_id,user_id,role) values(p,c,'client'),(p,f,'freelancer');
 insert into public.agreements(id,project_id,version,scope,created_by) values(a,p,1,'Approved test scope',c);
 insert into public.milestones(id,agreement_id,position,title,amount,due_date) values(m,a,1,'Test milestone',100,current_date);
 insert into public.acceptance_criteria(id,milestone_id,position,description) values(criterion,m,1,'Test evidence exists');
 insert into public.paypal_merchant_bindings(freelancer_id,merchant_id,merchant_email,credential_fingerprint,active,verified_at,verification_note)
 values(f,'TESTMERCHANT1','seller@example.test',repeat('a',64),true,now(),'Disposable fixture; not a live merchant');
 begin
   perform public.prepare_paypal_payment(outsider,p,m,'TESTMERCHANT1',repeat('a',64));
   raise exception 'FAIL: outsider could prepare payment';
 exception when insufficient_privilege then null; end;
 begin
   perform public.prepare_paypal_payment(f,p,m,'TESTMERCHANT1',repeat('a',64));
   raise exception 'FAIL: unaccepted agreement permitted';
 exception when raise_exception then if sqlerrm<>'PAYMENT_APPROVAL_REQUIRED' then raise; end if; end;
 insert into public.agreement_approvals(agreement_id,user_id,role) values(a,c,'client'),(a,f,'freelancer');
 insert into public.submission_links(id,milestone_id,project_id,created_by,freelancer_id) values(l,m,p,c,f);
 insert into public.evidence_submissions(id,project_id,milestone_id,link_id,submitted_by,revision,status) values(s,p,m,l,f,1,'submitted');
 begin
   perform public.prepare_paypal_payment(f,p,m,'TESTMERCHANT1',repeat('a',64));
   raise exception 'FAIL: unapproved evidence permitted';
 exception when raise_exception then if sqlerrm<>'PAYMENT_APPROVAL_REQUIRED' then raise; end if; end;
 insert into public.submission_reviews(submission_id,reviewed_by,decision,note,confirmed_criteria) values(s,c,'approved','Approved fixture',array[criterion]);
 update public.evidence_submissions set status='approved' where id=s;
 begin
   perform public.prepare_paypal_payment(f,p,m,'OTHERACCOUNT1',repeat('a',64));
   raise exception 'FAIL: mismatched merchant permitted';
 exception when raise_exception then if sqlerrm<>'PAYMENT_MERCHANT_NOT_CONFIGURED' then raise; end if; end;
 result:=public.prepare_paypal_payment(f,p,m,'TESTMERCHANT1',repeat('a',64));
 again:=public.prepare_paypal_payment(f,p,m,'TESTMERCHANT1',repeat('a',64));
 if result.id<>again.id or result.amount<>100 or result.currency<>'USD' or result.payer_id<>c or result.payer_email<>c::text||'@example.test' then raise exception 'FAIL: snapshot or idempotency mismatch'; end if;
 begin
   update public.payments set amount=1 where id=result.id;
   raise exception 'FAIL: financial snapshot was mutable';
 exception when raise_exception then if sqlerrm<>'PAYMENT_SNAPSHOT_IMMUTABLE' then raise; end if; end;
 claimed:=public.claim_paypal_payment(result.id,lease,true);
 if not (claimed->>'may_create')::boolean then raise exception 'FAIL: first attempt not claimed'; end if;
 begin
   perform public.claim_paypal_payment(result.id,gen_random_uuid(),true);
   raise exception 'FAIL: concurrent attempt acquired lease';
 exception when raise_exception then if sqlerrm<>'PAYMENT_BUSY' then raise; end if; end;
 perform public.fail_paypal_payment(result.id,lease,'{"code":"PAYPAL_TIMEOUT"}'::jsonb);
 claimed:=public.claim_paypal_payment(result.id,gen_random_uuid(),true);
 if (claimed->>'may_create')::boolean then raise exception 'FAIL: ambiguous create could run twice'; end if;
 if has_function_privilege('authenticated','public.prepare_paypal_payment(uuid,uuid,uuid,text,text)','EXECUTE') or
 has_function_privilege('anon','public.claim_paypal_payment(uuid,uuid,boolean)','EXECUTE') or
 has_function_privilege('authenticated','public.finish_paypal_payment(uuid,uuid,text,text,text,jsonb,text)','EXECUTE') then raise exception 'FAIL: browser can mutate financial state'; end if;
 perform set_config('proofpay.test.client',c::text,true);
 perform set_config('proofpay.test.outsider',outsider::text,true);
 perform set_config('proofpay.test.payment',result.id::text,true);
 raise notice 'PASS: approval, merchant, snapshot, duplicate prepare, concurrent lease and mutation grants';
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.outsider'),true);
do $$ begin
 if exists(select id from public.payments where id=current_setting('proofpay.test.payment')::uuid) then raise exception 'FAIL: outsider can read invoice'; end if;
 begin
   perform payer_email from public.payments;
   raise exception 'FAIL: browser can read private recipient snapshots';
 exception when insufficient_privilege then null; end;
 begin
   update public.payments set status='PAID' where id=current_setting('proofpay.test.payment')::uuid;
   raise exception 'FAIL: browser can mark paid';
 exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
do $$ begin
 if not exists(select id from public.payments where id=current_setting('proofpay.test.payment')::uuid) then raise exception 'FAIL: client cannot read own invoice'; end if;
 raise notice 'PASS: member/outsider RLS, private columns and no browser payment updates';
end; $$;
reset role;
rollback;
