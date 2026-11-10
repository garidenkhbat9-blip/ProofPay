begin;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'Expected %, got % (%)',expected,sqlerrm,sqlstate;
 end;
 raise exception 'Expected failure: %',expected;
end; $$;
do $$ declare c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(c,'archive-client@example.test',now()),(f,'archive-worker@example.test',now()),(o,'archive-outsider@example.test',now());
 perform set_config('test.archive.client',c::text,true); perform set_config('test.archive.worker',f::text,true); perform set_config('test.archive.outsider',o::text,true);
 perform set_config('test.archive.request',gen_random_uuid()::text,true);
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.archive.client'),true);
select set_config('test.archive.project',public.create_project('Archive fixture','Draft scope','website',100)::text,true);
select set_config('test.archive.agreement',public.create_agreement_version(current_setting('test.archive.project')::uuid,null,'Draft before assignment','',
 '[{"title":"Draft deliverable","amount":100,"due_date":"2099-01-01","criteria":["Source supplied"]}]')::text,true);
select pg_temp.expect_error(format('select public.approve_agreement_version(%L)',current_setting('test.archive.agreement')),'A freelancer must join before either party accepts');
select set_config('test.archive.invitation',public.invite_freelancer(current_setting('test.archive.project')::uuid,'archive-worker@example.test')::text,true);
do $$ begin
 if public.get_project_archive_state(current_setting('test.archive.project')::uuid)->>'reason'<>'INVITATION_PENDING' then raise exception 'Pending invitation not protected'; end if;
end; $$;
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,0)',current_setting('test.archive.project'),current_setting('test.archive.request')),'ARCHIVE_INVITATION_PENDING');
select public.revoke_project_invitation(current_setting('test.archive.invitation')::uuid);
select public.manage_project_archive(current_setting('test.archive.project')::uuid,'archive',current_setting('test.archive.request')::uuid,0);
select public.manage_project_archive(current_setting('test.archive.project')::uuid,'archive',current_setting('test.archive.request')::uuid,0);
do $$ begin
 if (select status from public.projects where id=current_setting('test.archive.project')::uuid)<>'archived' then raise exception 'Archive did not commit'; end if;
 if (select count(*) from public.project_archive_events)<>1 then raise exception 'Duplicate archive event'; end if;
 if (select count(*) from public.agreements)<>1 or (select count(*) from public.milestones)<>1 or (select count(*) from public.acceptance_criteria)<>1
    or (select count(*) from public.project_members)<>1 or (select count(*) from public.project_invitations where status='revoked')<>1 then raise exception 'Archive damaged retained records'; end if;
 if exists(select 1 from public.projects where status<>'archived') then raise exception 'Archived budget remains active'; end if;
 if not (public.get_project_archive_state(current_setting('test.archive.project')::uuid)->>'canReopen')::boolean then raise exception 'Reopen eligibility missing'; end if;
end; $$;
select pg_temp.expect_error(format('select public.invite_freelancer(%L,''archive-worker@example.test'')',current_setting('test.archive.project')),'Project unavailable');
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''reopen'',%L,1)',current_setting('test.archive.project'),current_setting('test.archive.request')),'ARCHIVE_REQUEST_REUSED');
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''reopen'',%L,0)',current_setting('test.archive.project'),gen_random_uuid()),'ARCHIVE_STALE');
select public.manage_project_archive(current_setting('test.archive.project')::uuid,'reopen',gen_random_uuid(),1);
select public.manage_project_archive(current_setting('test.archive.project')::uuid,'archive',current_setting('test.archive.request')::uuid,0);
do $$ begin
 if (select status from public.projects where id=current_setting('test.archive.project')::uuid)<>'draft' or (select count(*) from public.project_archive_events)<>2 then raise exception 'Late retry repeated a mutation'; end if;
 if (select sum(budget_amount) from public.projects where status<>'archived')<>100 then raise exception 'Reopen did not restore active budget'; end if;
end; $$;
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,0)',current_setting('test.archive.project'),gen_random_uuid()),'ARCHIVE_STALE');
select set_config('test.archive.invitation',public.invite_freelancer(current_setting('test.archive.project')::uuid,'archive-worker@example.test')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.archive.worker'),true);
select public.accept_project_invitation(current_setting('test.archive.invitation')::uuid);
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,2)',current_setting('test.archive.project'),gen_random_uuid()),'42501');
select set_config('request.jwt.claim.sub',current_setting('test.archive.outsider'),true);
select pg_temp.expect_error(format('select public.create_agreement_version(%L,null,''Unauthorized'','''',''[]'')',current_setting('test.archive.project')),'42501');
select pg_temp.expect_error(format('select public.get_project_archive_state(%L)',current_setting('test.archive.project')),'42501');
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,2)',current_setting('test.archive.project'),gen_random_uuid()),'42501');
do $$ begin if exists(select 1 from public.project_archive_events) then raise exception 'Outsider can read archive audit'; end if; end; $$;
select set_config('request.jwt.claim.sub',current_setting('test.archive.client'),true);
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,2)',current_setting('test.archive.project'),gen_random_uuid()),'ARCHIVE_COLLABORATION_ACTIVE');
select public.approve_agreement_version(current_setting('test.archive.agreement')::uuid);
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,2)',current_setting('test.archive.project'),gen_random_uuid()),'ARCHIVE_AGREEMENT_ACCEPTED');
select set_config('test.archive.agreement2',public.create_agreement_version(current_setting('test.archive.project')::uuid,current_setting('test.archive.agreement')::uuid,'New immutable terms','Revise requirements',
 '[{"title":"Updated deliverable","amount":100,"due_date":"2099-01-01","criteria":["Source and notes supplied"]}]')::text,true);
select pg_temp.expect_error(format('select public.approve_agreement_version(%L)',current_setting('test.archive.agreement')),'A newer agreement exists. Review the latest version.');
select pg_temp.expect_error('update public.projects set archive_revision=99','42501');
select pg_temp.expect_error('delete from public.project_archive_events','42501');
select pg_temp.expect_error('update public.project_archive_events set action=''archive''','42501');
reset role;
update auth.users set email_confirmed_at=null where id=current_setting('test.archive.client')::uuid;
set local role authenticated;
select pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,2)',current_setting('test.archive.project'),gen_random_uuid()),'42501');
reset role;
update auth.users set email_confirmed_at=now() where id=current_setting('test.archive.client')::uuid;
insert into public.projects(created_by,title,status) values(current_setting('test.archive.client')::uuid,'Legacy archive','archived');
insert into public.project_members(project_id,user_id,role) select id,created_by,'client' from public.projects where title='Legacy archive';
insert into public.projects(created_by,title) values(current_setting('test.archive.outsider')::uuid,'Not the creator');
insert into public.project_members(project_id,user_id,role) select id,current_setting('test.archive.client')::uuid,'client' from public.projects where title='Not the creator';
set local role authenticated;
do $$ declare p uuid; begin
 select id into p from public.projects where title='Legacy archive';
 if public.get_project_archive_state(p)->>'reason'<>'LEGACY_ARCHIVE' then raise exception 'Legacy archive reopened without provenance'; end if;
 perform pg_temp.expect_error(format('select public.manage_project_archive(%L,''reopen'',%L,0)',p,gen_random_uuid()),'ARCHIVE_LEGACY_ARCHIVE');
 select id into p from public.projects where title='Not the creator';
 perform pg_temp.expect_error(format('select public.manage_project_archive(%L,''archive'',%L,0)',p,gen_random_uuid()),'42501');
end; $$;
reset role;
set local role authenticated;
select set_config('test.archive.expiredproject',public.create_project('Expired invitation draft','Draft scope','website',10)::text,true);
select set_config('test.archive.expiredinvite',public.invite_freelancer(current_setting('test.archive.expiredproject')::uuid,'archive-worker@example.test')::text,true);
reset role;
update public.project_invitations set created_at=now()-interval '2 days',expires_at=now()-interval '1 hour' where id=current_setting('test.archive.expiredinvite')::uuid;
set local role authenticated;
select public.manage_project_archive(current_setting('test.archive.expiredproject')::uuid,'archive',gen_random_uuid(),0);
do $$ begin
 if not exists(select 1 from public.project_invitations where id=current_setting('test.archive.expiredinvite')::uuid) then raise exception 'Expired invitation was removed'; end if;
end; $$;
reset role;
alter table public.payments rename to payments_unavailable_fixture;
set local role authenticated;
do $$ begin
 if public.get_project_archive_state(current_setting('test.archive.expiredproject')::uuid)->>'reason'<>'SETUP_REQUIRED' then raise exception 'Missing payment schema was ignored'; end if;
 perform pg_temp.expect_error(format('select public.manage_project_archive(%L,''reopen'',%L,1)',current_setting('test.archive.expiredproject'),gen_random_uuid()),'ARCHIVE_SETUP_REQUIRED');
end; $$;
reset role;
alter table public.payments_unavailable_fixture rename to payments;
set local role anon;
select pg_temp.expect_error(format('select public.get_project_archive_state(%L)',current_setting('test.archive.project')),'42501');
reset role;
rollback;
