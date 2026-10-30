-- ProofPay AI | 001: Auth profiles, projects, membership and invitations
-- Run ONCE in Supabase SQL Editor as postgres, on a fresh ProofPay schema.
-- If these tables/functions already exist, STOP and reconcile migrations first.
-- This script does not drop existing tables. A conflict rolls back the transaction.
-- Scope: one client + at most one freelancer per project (MVP).
-- No email is sent by this SQL. The app must deliver notifications separately.
-- No AI, verification, invoice or payment integration is enabled by this migration.

begin;

create schema if not exists proofpay_private;
revoke all on schema proofpay_private from public, anon, authenticated;
grant usage on schema proofpay_private to authenticated;
-- Do not add proofpay_private to Supabase's exposed API schemas.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  preferred_workspace text not null default 'client'
    check (preferred_workspace in ('client', 'freelancer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- preferred_workspace is a UI preference, NEVER an authorization source.
-- Passwords and email identity remain in Supabase Auth; do not duplicate them here.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 10000),
  work_category text not null default 'website'
    check (work_category in ('website', 'design', 'video')),
  budget_amount numeric(12,2) not null default 0 check (budget_amount >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Budget is not an invoice, paid balance or escrow balance.

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('client', 'freelancer')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id),
  unique (project_id, role)
);
create index project_members_user_idx on public.project_members(user_id, project_id);
create index projects_created_by_idx on public.projects(created_by);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_title text not null, -- Snapshot shown to recipient before membership.
  invited_by uuid not null references public.profiles(id) on delete restrict,
  invited_email text not null check (
    invited_email = lower(btrim(invited_email))
    and char_length(invited_email) between 3 and 254
    and invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  role text not null default 'freelancer' check (role = 'freelancer'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  )
);
-- At most one pending invitation per project. Resending revokes the previous one.
create unique index project_invitations_pending_idx
  on public.project_invitations(project_id) where status = 'pending';
create index project_invitations_email_idx on public.project_invitations(invited_email);
create index project_invitations_inviter_idx on public.project_invitations(invited_by);
create index project_invitations_acceptor_idx on public.project_invitations(accepted_by);

create function proofpay_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger proofpay_profiles_updated before update on public.profiles
  for each row execute function proofpay_private.touch_updated_at();
create trigger proofpay_projects_updated before update on public.projects
  for each row execute function proofpay_private.touch_updated_at();

create function proofpay_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger proofpay_auth_user_created after insert on auth.users
  for each row execute function proofpay_private.handle_new_user();
-- Include users who signed up before the trigger existed.
insert into public.profiles(id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120)
from auth.users on conflict (id) do nothing;

-- Private helpers avoid recursive project_members RLS policies.
-- Each function derives the viewer from auth.uid(); no caller-supplied viewer ID.
create function proofpay_private.is_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members
    where project_id = p_project_id and user_id = (select auth.uid()));
$$;
create function proofpay_private.is_client(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members
    where project_id = p_project_id and user_id = (select auth.uid()) and role = 'client');
$$;
create function proofpay_private.shares_project(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members me
    join public.project_members them on them.project_id = me.project_id
    where me.user_id = (select auth.uid()) and them.user_id = p_user_id
  );
$$;
create function proofpay_private.verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(btrim(u.email)) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;

revoke all on public.profiles, public.projects, public.project_members,
  public.project_invitations from public, anon, authenticated;
grant select on public.profiles, public.projects, public.project_members,
  public.project_invitations to authenticated;
grant update (full_name, avatar_url, preferred_workspace) on public.profiles to authenticated;
grant update (title, description, work_category, budget_amount, due_date)
  on public.projects to authenticated;
-- No direct INSERT/DELETE grants. Project membership and invitation mutations
-- must pass through the checked RPCs below. No browser may self-assign a role.

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or proofpay_private.shares_project(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy projects_read_member on public.projects for select to authenticated
using (proofpay_private.is_member(id));
create policy projects_update_client on public.projects for update to authenticated
using (proofpay_private.is_client(id) and status <> 'archived')
with check (proofpay_private.is_client(id) and status <> 'archived');
create policy members_read_member on public.project_members for select to authenticated
using (proofpay_private.is_member(project_id));
create policy invitations_read on public.project_invitations for select to authenticated
using (proofpay_private.is_client(project_id)
  or invited_email = (select proofpay_private.verified_email()));

create function public.create_project(
  p_title text,
  p_description text default '',
  p_work_category text default 'website',
  p_budget_amount numeric default 0,
  p_due_date date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
begin
  if v_user is null or proofpay_private.verified_email() is null then
    raise exception 'Sign in with a verified email first' using errcode = '42501';
  end if;
  insert into public.projects(created_by, title, description, work_category, budget_amount, due_date)
  values (v_user, btrim(p_title), p_description, p_work_category, p_budget_amount, p_due_date)
  returning id into v_project;
  insert into public.project_members(project_id, user_id, role)
  values (v_project, v_user, 'client');
  return v_project;
end;
$$;

create function public.invite_freelancer(p_project_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_title text;
  v_id uuid;
begin
  if not proofpay_private.is_client(p_project_id) then
    raise exception 'Only the project client can invite' using errcode = '42501';
  end if;
  if proofpay_private.verified_email() is null then
    raise exception 'A verified email is required' using errcode = '42501';
  end if;
  if v_email is null or char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid invitation email' using errcode = '22023';
  end if;
  if v_email = proofpay_private.verified_email() then
    raise exception 'You cannot invite yourself to your own project' using errcode = '22023';
  end if;
  select title into v_title from public.projects
    where id = p_project_id and status <> 'archived' for update;
  if not found then raise exception 'Project unavailable'; end if;
  if exists (select 1 from public.project_members
    where project_id = p_project_id and role = 'freelancer') then
    raise exception 'This project already has a freelancer';
  end if;
  update public.project_invitations set status = 'revoked'
    where project_id = p_project_id and status = 'pending';
  insert into public.project_invitations(project_id, project_title, invited_by, invited_email)
  values (p_project_id, v_title, auth.uid(), v_email) returning id into v_id;
  return v_id;
end;
$$;

create function public.accept_project_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text := proofpay_private.verified_email();
  v_project uuid;
  v_inv public.project_invitations%rowtype;
begin
  if v_user is null or v_email is null then
    raise exception 'Sign in with a verified email first' using errcode = '42501';
  end if;
  -- Lock order is always project, then invitation (also used by invite/revoke).
  select project_id into v_project from public.project_invitations
    where id = p_invitation_id and invited_email = v_email;
  if not found then
    raise exception 'Invitation unavailable for this account' using errcode = '42501';
  end if;
  perform 1 from public.projects where id = v_project and status <> 'archived' for update;
  if not found then raise exception 'Project unavailable'; end if;
  select * into v_inv from public.project_invitations
    where id = p_invitation_id and invited_email = v_email for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  -- Retry after a successful accept returns the same project without duplicates.
  if v_inv.status = 'accepted' and v_inv.accepted_by = v_user then return v_project; end if;
  if v_inv.status <> 'pending' or v_inv.expires_at <= now() then
    raise exception 'Invitation is expired or no longer pending';
  end if;
  if exists (select 1 from public.project_members
    where project_id = v_project and (user_id = v_user or role = 'freelancer')) then
    raise exception 'A membership already exists for this project';
  end if;
  insert into public.project_members(project_id, user_id, role)
  values (v_project, v_user, 'freelancer');
  update public.project_invitations
    set status = 'accepted', accepted_by = v_user, accepted_at = now()
    where id = p_invitation_id;
  update public.projects set status = 'active' where id = v_project;
  return v_project;
end;
$$;

create function public.revoke_project_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  select project_id into v_project from public.project_invitations where id = p_invitation_id;
  if v_project is null or not proofpay_private.is_client(v_project) then
    raise exception 'Only the project client can revoke' using errcode = '42501';
  end if;
  perform 1 from public.projects where id = v_project for update;
  update public.project_invitations set status = 'revoked'
    where id = p_invitation_id and status = 'pending';
end;
$$;

-- PostgreSQL grants PUBLIC execute by default: explicitly narrow it here.
revoke all on all functions in schema proofpay_private from public, anon, authenticated;
grant execute on function proofpay_private.is_member(uuid),
  proofpay_private.is_client(uuid), proofpay_private.shares_project(uuid),
  proofpay_private.verified_email() to authenticated;
revoke all on function public.create_project(text,text,text,numeric,date),
  public.invite_freelancer(uuid,text), public.accept_project_invitation(uuid),
  public.revoke_project_invitation(uuid) from public, anon, authenticated;
grant execute on function public.create_project(text,text,text,numeric,date),
  public.invite_freelancer(uuid,text), public.accept_project_invitation(uuid),
  public.revoke_project_invitation(uuid) to authenticated;

commit;

-- SETUP CHECK (read-only): should return these 4 tables with rls_enabled = true.
select schemaname, tablename, rowsecurity as rls_enabled
from pg_tables where schemaname = 'public'
and tablename in ('profiles','projects','project_members','project_invitations')
order by tablename;

-- FRONTEND CALL EXAMPLES (comments only; do NOT run as SQL):
-- const { data: projectId, error } = await supabase.rpc('create_project', {
--   p_title: 'KlipScale website', p_description: 'Responsive landing page',
--   p_work_category: 'website', p_budget_amount: 2400, p_due_date: '2026-11-01'
-- });
-- await supabase.rpc('invite_freelancer', {
--   p_project_id: projectId, p_email: 'freelancer@example.com'
-- });
-- // The invited user signs in with that verified email, then:
-- await supabase.rpc('accept_project_invitation', { p_invitation_id: invitationId });
-- // Sidebar view: filter the current user's memberships by role.
-- await supabase.from('project_members').select('role, projects(*)')
--   .eq('user_id', user.id).eq('role', 'freelancer');
-- // RLS remains the authorization boundary, independent of this UI filter.
--
-- REQUIRED BEFORE A REAL LAUNCH:
-- Test with three separate authenticated users A(client), B(invitee), C(unrelated).
-- A creates a project; B/C cannot read it before membership.
-- A invites B; C cannot see/accept B's invitation; B accepts once and may retry.
-- B can read the project but cannot edit it or change project_members directly.
-- A cannot invite themselves. Anonymous users cannot read tables or call RPCs.
-- Changing preferred_workspace must never alter access to any project.
-- Confirm Email must be enabled in Supabase Auth. Do not expose service_role keys.
-- This foundation permits edits to project briefs; lock/version approved agreement
-- terms in the later agreements migration before enabling two-party approvals.
