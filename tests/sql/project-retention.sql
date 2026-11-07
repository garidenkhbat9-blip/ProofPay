-- Disposable in-memory PostgreSQL fixture only. No hosted database connection.
-- Verifies the CURRENT boundary: even owners cannot delete/archive yet.
begin;
do $$
declare c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); o uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
 m uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); pay uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (c,'retention-client@example.test',now()),(f,'retention-worker@example.test',now()),(o,'retention-outsider@example.test',now());
 insert into public.projects(id,created_by,title,status,budget_amount) values(p,c,'Protected financial project','active',100),(d,c,'Owned draft','draft',0);
 insert into public.project_members(project_id,user_id,role) values(p,c,'client'),(p,f,'freelancer'),(d,c,'client');
 insert into public.project_invitations(project_id,project_title,invited_by,invited_email,status) values(d,'Owned draft',c,'retention-worker@example.test','revoked');
 insert into public.agreements(id,project_id,version,scope,created_by) values(a,p,1,'Retain accepted scope',c);
 insert into public.agreement_approvals(agreement_id,user_id,role) values(a,c,'client'),(a,f,'freelancer');
 insert into public.milestones(id,agreement_id,position,title,amount,due_date) values(m,a,1,'Delivery',100,current_date);
 insert into public.submission_links(id,milestone_id,project_id,created_by,freelancer_id) values(l,m,p,c,f);
 insert into public.evidence_submissions(id,project_id,milestone_id,link_id,submitted_by,revision,status) values(s,p,m,l,f,1,'approved');
 insert into public.submission_reviews(submission_id,reviewed_by,decision,note) values(s,c,'approved','Retain decision');
 insert into public.paypal_merchant_bindings(id,freelancer_id,merchant_id,merchant_email,credential_fingerprint) values(b,f,'TESTMERCHANT1','merchant@example.test',repeat('a',64));
 insert into public.payments(id,project_id,milestone_id,agreement_id,submission_id,merchant_binding_id,freelancer_id,payer_id,payer_email,merchant_id,merchant_email,credential_fingerprint,amount,currency,invoice_number,paypal_invoice_id,status,last_verified_at)
 values(pay,p,m,a,s,b,f,c,'retention-client@example.test','TESTMERCHANT1','merchant@example.test',repeat('a',64),100,'USD','retention-fixture','INV2-RETAIN','PAID',now());
 insert into public.payment_history(payment_id,project_id,status,source) values(pay,p,'PAID','webhook');
 insert into public.paypal_webhook_events(event_id,event_type,invoice_id,payload_sha256,verified_event) values('retention-event','INVOICING.INVOICE.PAID','INV2-RETAIN',repeat('b',64),'{}');
 perform set_config('proofpay.test.client',c::text,true);
 perform set_config('proofpay.test.freelancer',f::text,true);
 perform set_config('proofpay.test.outsider',o::text,true);
 perform set_config('proofpay.test.project',p::text,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
do $$ begin
 if (select count(*) from public.projects)<>2 then raise exception 'FAIL: owner cannot see all owned projects'; end if;
 if not exists(select 1 from public.project_invitations where status='revoked') then raise exception 'FAIL: invitation history missing'; end if;
 if public.get_project_archive_state(current_setting('proofpay.test.project')::uuid)->>'reason'<>'PAYMENT_HISTORY' then raise exception 'FAIL: archive ignores financial history'; end if;
 begin
  perform public.manage_project_archive(current_setting('proofpay.test.project')::uuid,'archive',gen_random_uuid(),0);
  raise exception 'FAIL: financially relevant project was archived';
 exception when raise_exception then if sqlerrm<>'ARCHIVE_PAYMENT_HISTORY' then raise; end if; end;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
do $$ begin
 if (select count(*) from public.projects)<>1 then raise exception 'FAIL: freelancer can see an unjoined draft'; end if;
 if (select count(*) from public.payments)<>1 then raise exception 'FAIL: participant lost payment access'; end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.outsider'),true);
do $$ begin
 if exists(select 1 from public.projects where id=current_setting('proofpay.test.project')::uuid) or exists(select 1 from public.payments) then raise exception 'FAIL: guessed ID disclosed records'; end if;
end;$$;

-- Identical direct requests from an owner, participant and outsider must fail.
do $$ declare actor text; tbl text; begin
 foreach actor in array array[current_setting('proofpay.test.client'),current_setting('proofpay.test.freelancer'),current_setting('proofpay.test.outsider')] loop
  perform set_config('request.jwt.claim.sub',actor,true);
  begin
   delete from public.projects;
   raise exception 'FAIL: project deletion is enabled without reviewed lifecycle rules';
  exception when insufficient_privilege then null; end;
  begin
   update public.projects set status='archived';
   raise exception 'FAIL: direct archive bypasses collaboration/payment protection';
  exception when insufficient_privilege then null; end;
  foreach tbl in array array['agreements','agreement_approvals','submission_links','evidence_submissions','submission_reviews','payments','payment_history','paypal_webhook_events','project_members','project_invitations'] loop
   begin
    execute format('delete from public.%I',tbl);
    raise exception 'FAIL: authenticated caller can delete retained table %',tbl;
   exception when insufficient_privilege then null; end;
  end loop;
 end loop;
end;$$;
reset role;
do $$ begin
 if (select count(*) from public.projects)<>2
 or (select count(*) from public.agreement_approvals)<>2
 or (select count(*) from public.evidence_submissions)<>1
 or (select count(*) from public.payments where paypal_invoice_id='INV2-RETAIN' and status='PAID')<>1
 or (select count(*) from public.payment_history)<>1
 or (select count(*) from public.paypal_webhook_events where event_id='retention-event')<>1 then
  raise exception 'FAIL: project/financial records changed';
 end if;
end;$$;
rollback;
