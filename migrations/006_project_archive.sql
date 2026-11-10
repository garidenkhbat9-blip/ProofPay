begin;

alter table public.projects
 add column archived_at timestamptz,
 add column archive_revision integer not null default 0 check (archive_revision >= 0);

create table public.project_archive_events (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 action text not null check (action in ('archive','reopen')),
 revision integer not null check (revision > 0),
 created_at timestamptz not null default now(),
 unique(actor_id,request_id),
 unique(project_id,revision)
);
alter table public.project_archive_events enable row level security;
revoke all on public.project_archive_events from public,anon,authenticated;
grant select on public.project_archive_events to authenticated;
create policy project_archive_events_read on public.project_archive_events
 for select to authenticated using (proofpay_private.is_member(project_id));

create function proofpay_private.project_archive_blocker(p_project uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
 if to_regclass('public.payments') is null or to_regclass('public.payment_history') is null
    or to_regclass('public.paypal_webhook_events') is null then return 'SETUP_REQUIRED'; end if;
 if exists(select 1 from public.payments where project_id=p_project)
    or exists(select 1 from public.payment_history where project_id=p_project) then return 'PAYMENT_HISTORY'; end if;
 if exists(select 1 from public.submission_links where project_id=p_project)
    or exists(select 1 from public.evidence_submissions where project_id=p_project) then return 'DELIVERY_HISTORY'; end if;
 if exists(select 1 from public.agreement_approvals ap join public.agreements a on a.id=ap.agreement_id where a.project_id=p_project)
    then return 'AGREEMENT_ACCEPTED'; end if;
 if exists(select 1 from public.project_members where project_id=p_project and role='freelancer')
    or exists(select 1 from public.project_invitations where project_id=p_project and status='accepted') then return 'COLLABORATION_ACTIVE'; end if;
 if exists(select 1 from public.project_invitations where project_id=p_project and status='pending' and expires_at>now())
    then return 'INVITATION_PENDING'; end if;
 return null;
end; $$;

create function public.get_project_archive_state(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; reason text;
begin
 if auth.uid() is null or proofpay_private.verified_email() is null then
  raise exception 'ARCHIVE_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into p from public.projects where id=p_project_id;
 if not found or p.created_by<>auth.uid() or not proofpay_private.is_client(p_project_id) then
  raise exception 'ARCHIVE_NOT_AUTHORIZED' using errcode='42501'; end if;
 reason:=proofpay_private.project_archive_blocker(p_project_id);
 if reason is null then
  if p.status='active' then reason:='COLLABORATION_ACTIVE';
  elsif p.status='archived' and (p.archived_at is null or not exists(
   select 1 from public.project_archive_events where project_id=p.id and revision=p.archive_revision and action='archive'
  )) then reason:='LEGACY_ARCHIVE'; end if;
 end if;
 return jsonb_build_object('available',true,'status',p.status,'revision',p.archive_revision,
  'archivedAt',p.archived_at,'canArchive',reason is null and p.status='draft',
  'canReopen',reason is null and p.status='archived','reason',reason);
end; $$;

create function public.manage_project_archive(p_project_id uuid,p_action text,p_request_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; previous public.project_archive_events%rowtype; state jsonb;
begin
 if auth.uid() is null or proofpay_private.verified_email() is null then
  raise exception 'ARCHIVE_NOT_AUTHORIZED' using errcode='42501'; end if;
 if p_action is null or p_action not in ('archive','reopen') or p_request_id is null or p_expected_revision is null or p_expected_revision<0 then
  raise exception 'ARCHIVE_INVALID_REQUEST' using errcode='22023'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if not found or p.created_by<>auth.uid() or not proofpay_private.is_client(p_project_id) then
  raise exception 'ARCHIVE_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into previous from public.project_archive_events where actor_id=auth.uid() and request_id=p_request_id;
 if found then
  if previous.project_id<>p_project_id or previous.action<>p_action then raise exception 'ARCHIVE_REQUEST_REUSED'; end if;
  return public.get_project_archive_state(p_project_id) || jsonb_build_object('confirmed',true,'replayed',true);
 end if;
 if p.archive_revision<>p_expected_revision then raise exception 'ARCHIVE_STALE'; end if;
 state:=public.get_project_archive_state(p_project_id);
 if state->>'reason' is not null then raise exception 'ARCHIVE_%',state->>'reason'; end if;
 if (p_action='archive' and p.status<>'draft') or (p_action='reopen' and p.status<>'archived') then
  raise exception 'ARCHIVE_STALE'; end if;
 update public.projects set status=case when p_action='archive' then 'archived' else 'draft' end,
  archived_at=case when p_action='archive' then now() else null end,
  archive_revision=archive_revision+1 where id=p_project_id;
 insert into public.project_archive_events(project_id,actor_id,request_id,action,revision)
  values(p_project_id,auth.uid(),p_request_id,p_action,p.archive_revision+1);
 return public.get_project_archive_state(p_project_id) || jsonb_build_object('confirmed',true,'replayed',false);
end; $$;

revoke all on function proofpay_private.project_archive_blocker(uuid) from public,anon,authenticated;
revoke all on function public.get_project_archive_state(uuid),public.manage_project_archive(uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.get_project_archive_state(uuid),public.manage_project_archive(uuid,text,uuid,integer) to authenticated;
commit;
