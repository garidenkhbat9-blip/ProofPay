-- ProofPay 002: versioned agreements, milestones, criteria and mutual acceptance.
-- Requires 001 foundation. Run ONCE as postgres in Supabase SQL Editor.
-- Existing conflicting objects cause the entire transaction to roll back.
-- Saved versions are immutable. Every edit creates a new version.
begin;

create table public.agreements (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete restrict,
 version integer not null check (version > 0),
 scope text not null check (char_length(btrim(scope)) between 1 and 10000),
 change_note text not null default '' check (char_length(change_note) <= 2000),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(project_id, version)
);
create table public.milestones (
 id uuid primary key default gen_random_uuid(),
 agreement_id uuid not null references public.agreements(id) on delete restrict,
 position integer not null check(position between 1 and 20),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 description text not null default '' check(char_length(description) <= 5000),
 amount numeric(12,2) not null check(amount >= 0),
 due_date date not null,
 unique(agreement_id,position)
);
create table public.acceptance_criteria (
 id uuid primary key default gen_random_uuid(),
 milestone_id uuid not null references public.milestones(id) on delete restrict,
 position integer not null check(position between 1 and 30),
 description text not null check(char_length(btrim(description)) between 1 and 1000),
 unique(milestone_id,position)
);
create table public.agreement_approvals (
 agreement_id uuid not null references public.agreements(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 role text not null check(role in ('client','freelancer')),
 approved_at timestamptz not null default now(),
 primary key(agreement_id,user_id),
 unique(agreement_id,role)
);

alter table public.agreements enable row level security;
alter table public.milestones enable row level security;
alter table public.acceptance_criteria enable row level security;
alter table public.agreement_approvals enable row level security;
revoke all on public.agreements,public.milestones,public.acceptance_criteria,public.agreement_approvals from public,anon,authenticated;
grant select on public.agreements,public.milestones,public.acceptance_criteria,public.agreement_approvals to authenticated;
create policy agreements_member_read on public.agreements for select to authenticated
 using (proofpay_private.is_member(project_id));
create policy milestones_member_read on public.milestones for select to authenticated
 using (exists(select 1 from public.agreements a where a.id=agreement_id));
create policy criteria_member_read on public.acceptance_criteria for select to authenticated
 using (exists(select 1 from public.milestones m where m.id=milestone_id));
create policy approvals_member_read on public.agreement_approvals for select to authenticated
 using (exists(select 1 from public.agreements a where a.id=agreement_id));

create function public.create_agreement_version(
 p_project_id uuid, p_expected_agreement_id uuid, p_scope text,
 p_change_note text, p_milestones jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid();
 v_project public.projects%rowtype;
 v_previous public.agreements%rowtype;
 v_agreement uuid; v_milestone uuid; v_item jsonb; v_criterion jsonb;
 v_pos integer:=0; v_cpos integer; v_amount numeric; v_total numeric:=0;
begin
 if v_user is null or proofpay_private.verified_email() is null or not proofpay_private.is_client(p_project_id) then
  raise exception 'Only the verified project client can create agreement versions' using errcode='42501';
 end if;
 select * into v_project from public.projects where id=p_project_id and status<>'archived' for update;
 if not found then raise exception 'Project unavailable'; end if;
 select * into v_previous from public.agreements where project_id=p_project_id order by version desc limit 1;
 if v_previous.id is distinct from p_expected_agreement_id then
  raise exception 'Agreement changed. Refresh and review the latest version before saving.';
 end if;
 if p_scope is null or char_length(btrim(p_scope)) not between 1 and 10000 then raise exception 'Enter an agreement scope (up to 10000 characters)'; end if;
 if v_previous.id is not null and char_length(btrim(coalesce(p_change_note,'')))=0 then raise exception 'Describe what changed in this version'; end if;
 if jsonb_typeof(p_milestones) is distinct from 'array' then raise exception 'Milestones must be an array'; end if;
 if jsonb_array_length(p_milestones) not between 1 and 20 then raise exception 'Add between 1 and 20 milestones'; end if;
 insert into public.agreements(project_id,version,scope,change_note,created_by)
 values(p_project_id,coalesce(v_previous.version,0)+1,btrim(p_scope),btrim(coalesce(p_change_note,'')),v_user) returning id into v_agreement;
 for v_item in select value from jsonb_array_elements(p_milestones) loop
  v_pos:=v_pos+1;
  if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'title') is distinct from 'string'
    or jsonb_typeof(v_item->'amount') is distinct from 'number' or jsonb_typeof(v_item->'due_date') is distinct from 'string' then
   raise exception 'Each milestone needs a title, amount and due date';
  end if;
  v_amount:=(v_item->>'amount')::numeric;
  if v_amount<0 or v_amount<>round(v_amount,2) or v_amount>9999999999.99 then raise exception 'Use non-negative amounts with at most two decimal places'; end if;
  if jsonb_typeof(v_item->'criteria') is distinct from 'array' then raise exception 'Each milestone needs acceptance criteria'; end if;
  if jsonb_array_length(v_item->'criteria') not between 1 and 30 then raise exception 'Add between 1 and 30 criteria per milestone'; end if;
  insert into public.milestones(agreement_id,position,title,description,amount,due_date)
   values(v_agreement,v_pos,btrim(v_item->>'title'),coalesce(v_item->>'description',''),v_amount,(v_item->>'due_date')::date) returning id into v_milestone;
  v_total:=v_total+v_amount; v_cpos:=0;
  for v_criterion in select value from jsonb_array_elements(v_item->'criteria') loop
   if jsonb_typeof(v_criterion) is distinct from 'string' then raise exception 'Criteria must be text'; end if;
   v_cpos:=v_cpos+1;
   insert into public.acceptance_criteria(milestone_id,position,description) values(v_milestone,v_cpos,btrim(v_criterion #>> '{}'));
  end loop;
 end loop;
 if v_total<>v_project.budget_amount then raise exception 'Milestone total must equal the project planned budget (%)',v_project.budget_amount; end if;
 return v_agreement;
end;
$$;

create function public.approve_agreement_version(p_agreement_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_project uuid; v_latest uuid; v_role text; v_user uuid:=auth.uid();
begin
 if v_user is null or proofpay_private.verified_email() is null then raise exception 'Sign in with a verified email' using errcode='42501'; end if;
 select project_id into v_project from public.agreements where id=p_agreement_id;
 if v_project is null or not proofpay_private.is_member(v_project) then raise exception 'Agreement unavailable' using errcode='42501'; end if;
 perform 1 from public.projects where id=v_project and status<>'archived' for update;
 if not found then raise exception 'Project unavailable'; end if;
 select id into v_latest from public.agreements where project_id=v_project order by version desc limit 1;
 if v_latest is distinct from p_agreement_id then raise exception 'A newer agreement exists. Review the latest version.'; end if;
 if not exists(select 1 from public.project_members where project_id=v_project and role='freelancer') then raise exception 'A freelancer must join before either party accepts'; end if;
 select role into v_role from public.project_members where project_id=v_project and user_id=v_user;
 insert into public.agreement_approvals(agreement_id,user_id,role) values(p_agreement_id,v_user,v_role)
 on conflict(agreement_id,user_id) do nothing;
 return p_agreement_id;
end;
$$;
revoke all on function public.create_agreement_version(uuid,uuid,text,text,jsonb),public.approve_agreement_version(uuid) from public,anon,authenticated;
grant execute on function public.create_agreement_version(uuid,uuid,text,text,jsonb),public.approve_agreement_version(uuid) to authenticated;
commit;
