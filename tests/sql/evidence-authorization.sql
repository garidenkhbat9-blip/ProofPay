begin;
do $$
declare c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); o uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (c,'client@example.test',now(),'{}'),(f,'worker@example.test',now(),'{}'),(o,'outsider@example.test',now(),'{}');
 perform set_config('proofpay.test.client',c::text,true);
 perform set_config('proofpay.test.freelancer',f::text,true);
 perform set_config('proofpay.test.outsider',o::text,true);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
select set_config('proofpay.test.project',public.create_project('Disposable website','Test scope','website',100,current_date+7)::text,true);
select set_config('proofpay.test.invitation',public.invite_freelancer(current_setting('proofpay.test.project')::uuid,'worker@example.test')::text,true);
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
select public.accept_project_invitation(current_setting('proofpay.test.invitation')::uuid);
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
select set_config('proofpay.test.agreement',public.create_agreement_version(current_setting('proofpay.test.project')::uuid,null,'Deliver source files','',
 jsonb_build_array(jsonb_build_object('title','Source delivery','description','Deliver files','amount',100,'due_date',(current_date+7)::text,'criteria',jsonb_build_array('Source files supplied'))))::text,true);
select set_config('proofpay.test.milestone',(select id::text from public.milestones where agreement_id=current_setting('proofpay.test.agreement')::uuid),true);
select public.approve_agreement_version(current_setting('proofpay.test.agreement')::uuid);
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
select public.approve_agreement_version(current_setting('proofpay.test.agreement')::uuid);
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
select set_config('proofpay.test.link',public.create_submission_link(current_setting('proofpay.test.milestone')::uuid,'Upload a text note')::text,true);
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
select set_config('proofpay.test.submission',public.begin_evidence_submission(current_setting('proofpay.test.link')::uuid)::text,true);
insert into storage.objects(bucket_id,name,metadata) values('proofpay-evidence',current_setting('proofpay.test.submission')||'/note.txt','{"size":12}');

select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
do $$ begin
 if exists(select 1 from public.evidence_submissions) or exists(select 1 from storage.objects) then
  raise exception 'FAIL: client can read freelancer upload draft'; end if;
 begin
  perform public.begin_evidence_submission(current_setting('proofpay.test.link')::uuid);
  raise exception 'FAIL: client can submit as freelancer';
 exception when insufficient_privilege then null; end;
end;$$;

select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
select public.submit_evidence(current_setting('proofpay.test.submission')::uuid,'Actual fixture notes',
 jsonb_build_array(jsonb_build_object('kind','file','label','note.txt','storage_path',current_setting('proofpay.test.submission')||'/note.txt')));
do $$ declare changed integer; begin
 update storage.objects set metadata='{"size":1}'; get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: finalized evidence can be overwritten'; end if;
 delete from storage.objects; get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: finalized evidence can be deleted'; end if;
 begin
  perform public.review_evidence(current_setting('proofpay.test.submission')::uuid,'approved','Self approval','{}');
  raise exception 'FAIL: freelancer can approve own evidence';
 exception when insufficient_privilege then null; end;
end;$$;

select set_config('request.jwt.claim.sub',current_setting('proofpay.test.outsider'),true);
do $$ begin
 if exists(select 1 from public.projects) or exists(select 1 from public.evidence_submissions)
   or exists(select 1 from public.evidence_artifacts) or exists(select 1 from storage.objects) then
  raise exception 'FAIL: outsider can read private evidence'; end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values('proofpay-evidence',current_setting('proofpay.test.submission')||'/attack.txt','{"size":1}');
  raise exception 'FAIL: outsider can upload evidence';
 exception when insufficient_privilege then null; end;
end;$$;

select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
do $$ begin
 if (select count(*) from public.evidence_submissions)<>1 or (select count(*) from public.evidence_artifacts)<>1 or (select count(*) from storage.objects)<>1 then
  raise exception 'FAIL: client cannot read finalized evidence'; end if;
 begin
  perform public.review_evidence(current_setting('proofpay.test.submission')::uuid,'approved','Unchecked','{}');
  raise exception 'FAIL: approval did not require all criteria';
 exception when raise_exception then if sqlerrm<>'Confirm every acceptance criterion before approving' then raise; end if; end;
end;$$;
select public.review_evidence(current_setting('proofpay.test.submission')::uuid,'changes','Add details','{}');
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.freelancer'),true);
select set_config('proofpay.test.revision2',public.begin_evidence_submission(current_setting('proofpay.test.link')::uuid)::text,true);
select public.submit_evidence(current_setting('proofpay.test.revision2')::uuid,'Revised notes',
 jsonb_build_array(jsonb_build_object('kind','url','label','Source delivery','url','https://example.test/source')));
select set_config('request.jwt.claim.sub',current_setting('proofpay.test.client'),true);
select public.review_evidence(current_setting('proofpay.test.revision2')::uuid,'approved','All requirements checked',
 array(select id from public.acceptance_criteria where milestone_id=current_setting('proofpay.test.milestone')::uuid));
do $$ begin
 if (select notes from public.evidence_submissions where id=current_setting('proofpay.test.submission')::uuid)<>'Actual fixture notes' then raise exception 'FAIL: old evidence changed'; end if;
 if (select revision from public.evidence_submissions where id=current_setting('proofpay.test.revision2')::uuid)<>2 then raise exception 'FAIL: revision did not advance'; end if;
 if exists(select id from public.payments) then raise exception 'FAIL: approval created payment'; end if;
 if public.get_project_archive_state(current_setting('proofpay.test.project')::uuid)->>'reason'<>'DELIVERY_HISTORY' then
  raise exception 'FAIL: delivery history did not block archive'; end if;
 begin
  perform public.manage_project_archive(current_setting('proofpay.test.project')::uuid,'archive',gen_random_uuid(),0);
  raise exception 'FAIL: project with evidence was archived';
 exception when raise_exception then if sqlerrm<>'ARCHIVE_DELIVERY_HISTORY' then raise; end if; end;
 if (select count(*) from public.evidence_artifacts)<>2 or (select count(*) from public.submission_reviews)<>2 then
  raise exception 'FAIL: archive attempt damaged evidence or reviews'; end if;
end;$$;
reset role;
rollback;
