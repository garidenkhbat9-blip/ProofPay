begin;
create table public.submission_links (
 id uuid primary key default gen_random_uuid(),
 milestone_id uuid not null references public.milestones(id),
 project_id uuid not null references public.projects(id),
 created_by uuid not null references public.profiles(id),
 freelancer_id uuid not null references public.profiles(id),
 instructions text not null default '' check(char_length(instructions)<=5000),
 active boolean not null default true,
 expires_at timestamptz not null default(now()+interval '14 days'),
 created_at timestamptz not null default now()
);
create unique index one_active_submission_link on public.submission_links(milestone_id) where active;
create table public.evidence_submissions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 milestone_id uuid not null references public.milestones(id),
 link_id uuid not null references public.submission_links(id),
 submitted_by uuid not null references public.profiles(id),
 revision integer not null check(revision>0),
 status text not null default 'uploading' check(status in ('uploading','submitted','changes','approved')),
 notes text not null default '' check(char_length(notes)<=10000),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 unique(milestone_id,revision)
);
create table public.evidence_artifacts (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.evidence_submissions(id),
 kind text not null check(kind in ('file','url')),
 label text not null check(char_length(label) between 1 and 255),
 storage_path text unique,
 url text check(char_length(url)<=2048 and url ~ '^https?://'),
 size_bytes bigint check(size_bytes>=0 and size_bytes<=20971520),
 check((kind='file' and storage_path is not null and url is null and size_bytes is not null)
 or (kind='url' and url is not null and storage_path is null and size_bytes is null))
);
create table public.submission_reviews (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique references public.evidence_submissions(id),
 reviewed_by uuid not null references public.profiles(id),
 decision text not null check(decision in ('approved','changes')),
 note text not null check(char_length(btrim(note)) between 1 and 5000),
 confirmed_criteria uuid[] not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.submission_links enable row level security;
alter table public.evidence_submissions enable row level security;
alter table public.evidence_artifacts enable row level security;
alter table public.submission_reviews enable row level security;
revoke all on public.submission_links,public.evidence_submissions,public.evidence_artifacts,public.submission_reviews from public,anon,authenticated;
grant select on public.submission_links,public.evidence_submissions,public.evidence_artifacts,public.submission_reviews to authenticated;
create policy links_member_read on public.submission_links for select to authenticated using(proofpay_private.is_member(project_id));
create policy submissions_member_read on public.evidence_submissions for select to authenticated using(proofpay_private.is_member(project_id) and (status<>'uploading' or submitted_by=auth.uid()));
create policy artifacts_member_read on public.evidence_artifacts for select to authenticated using(exists(select 1 from public.evidence_submissions s where s.id=submission_id));
create policy reviews_member_read on public.submission_reviews for select to authenticated using(exists(select 1 from public.evidence_submissions s where s.id=submission_id));

create function proofpay_private.lock_handoff_milestone(p_mid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_project uuid;v_agreement uuid;v_latest uuid;
begin
 select a.project_id,a.id into v_project,v_agreement from public.milestones m join public.agreements a on a.id=m.agreement_id where m.id=p_mid;
 if v_project is null or not proofpay_private.is_member(v_project) or proofpay_private.verified_email() is null then raise exception 'Milestone unavailable' using errcode='42501'; end if;
 perform 1 from public.projects where id=v_project and status<>'archived' for update;
 if not found then raise exception 'Project unavailable'; end if;
 select id into v_latest from public.agreements where project_id=v_project order by version desc limit 1;
 if v_latest<>v_agreement then raise exception 'This milestone belongs to an older agreement. Review the latest version.'; end if;
 if (select count(*) from public.agreement_approvals where agreement_id=v_agreement)<>2 then raise exception 'Both parties must accept this agreement first'; end if;
 return v_project;
end;$$;

create function public.create_submission_link(p_milestone_id uuid,p_instructions text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_project uuid;v_freelancer uuid;v_id uuid;
begin
 v_project:=proofpay_private.lock_handoff_milestone(p_milestone_id);
 if not proofpay_private.is_client(v_project) then raise exception 'Only the client can create submission links' using errcode='42501'; end if;
 if exists(select 1 from public.evidence_submissions where milestone_id=p_milestone_id and status in ('submitted','approved')) then raise exception 'Review the current submission first, or this milestone is already approved'; end if;
 select user_id into v_freelancer from public.project_members where project_id=v_project and role='freelancer';
 if v_freelancer is null then raise exception 'Invite a freelancer first'; end if;
 update public.submission_links set active=false where milestone_id=p_milestone_id and active;
 insert into public.submission_links(milestone_id,project_id,created_by,freelancer_id,instructions)
 values(p_milestone_id,v_project,auth.uid(),v_freelancer,coalesce(p_instructions,'')) returning id into v_id;
 return v_id;
end;$$;
create function public.revoke_submission_link(p_link_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_project uuid;
begin
 select project_id into v_project from public.submission_links where id=p_link_id;
 if v_project is null or not proofpay_private.is_client(v_project) then raise exception 'Link unavailable' using errcode='42501'; end if;
 perform 1 from public.projects where id=v_project for update;
 update public.submission_links set active=false where id=p_link_id;
end;$$;

create function public.begin_evidence_submission(p_link_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_link public.submission_links%rowtype;v_latest public.evidence_submissions%rowtype;v_id uuid;v_project uuid;
begin
 select * into v_link from public.submission_links where id=p_link_id;
 if not found or v_link.freelancer_id<>auth.uid() then raise exception 'Link unavailable for this account' using errcode='42501'; end if;
 v_project:=proofpay_private.lock_handoff_milestone(v_link.milestone_id);
 select * into v_link from public.submission_links where id=p_link_id;
 if not v_link.active or v_link.expires_at<=now() then raise exception 'This submission link has expired or been revoked'; end if;
 select * into v_latest from public.evidence_submissions where milestone_id=v_link.milestone_id order by revision desc limit 1;
 if v_latest.status='uploading' and v_latest.link_id=p_link_id then return v_latest.id; end if;
 if v_latest.status in ('submitted','approved') then raise exception 'Await client review before sending another revision'; end if;
 insert into public.evidence_submissions(project_id,milestone_id,link_id,submitted_by,revision)
 values(v_project,v_link.milestone_id,p_link_id,auth.uid(),coalesce(v_latest.revision,0)+1) returning id into v_id;
 return v_id;
end;$$;

insert into storage.buckets(id,name,public,file_size_limit) values('proofpay-evidence','proofpay-evidence',false,20971520);
create function proofpay_private.can_upload_evidence(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evidence_submissions s join public.submission_links l on l.id=s.link_id
 join public.milestones m on m.id=s.milestone_id
 where split_part(p_name,'/',1)=s.id::text and s.submitted_by=auth.uid() and s.status='uploading'
 and l.active and l.expires_at>now() and proofpay_private.is_member(s.project_id)
 and m.agreement_id=(select a.id from public.agreements a where a.project_id=s.project_id order by a.version desc limit 1));
$$;
create function proofpay_private.can_read_evidence(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evidence_submissions s where split_part(p_name,'/',1)=s.id::text
 and proofpay_private.is_member(s.project_id) and
 ((s.status='uploading' and s.submitted_by=auth.uid()) or exists(select 1 from public.evidence_artifacts e where e.submission_id=s.id and e.storage_path=p_name)));
$$;
create policy proofpay_evidence_insert on storage.objects for insert to authenticated
 with check(bucket_id='proofpay-evidence' and proofpay_private.can_upload_evidence(name));
create policy proofpay_evidence_read on storage.objects for select to authenticated
 using(bucket_id='proofpay-evidence' and proofpay_private.can_read_evidence(name));

create function public.submit_evidence(p_submission_id uuid,p_notes text,p_artifacts jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_s public.evidence_submissions%rowtype;v_link public.submission_links%rowtype;v_item jsonb;v_size bigint;v_latest uuid;
begin
 select * into v_s from public.evidence_submissions where id=p_submission_id;
 if not found or v_s.submitted_by<>auth.uid() then raise exception 'Submission unavailable' using errcode='42501'; end if;
 perform proofpay_private.lock_handoff_milestone(v_s.milestone_id);
 select * into v_s from public.evidence_submissions where id=p_submission_id;
 if v_s.status<>'uploading' then return v_s.id; end if;
 select id into v_latest from public.evidence_submissions where milestone_id=v_s.milestone_id order by revision desc limit 1;
 if v_latest<>v_s.id then raise exception 'A newer revision exists'; end if;
 select * into v_link from public.submission_links where id=v_s.link_id;
 if not v_link.active or v_link.expires_at<=now() then raise exception 'Link expired or revoked'; end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' then raise exception 'Evidence must be a list'; end if;
 if jsonb_array_length(p_artifacts) not between 1 and 10 then raise exception 'Attach between 1 and 10 files or links'; end if;
 for v_item in select value from jsonb_array_elements(p_artifacts) loop
  if v_item->>'kind'='file' then
   if split_part(v_item->>'storage_path','/',1)<>v_s.id::text then raise exception 'File does not belong to this submission'; end if;
   select (metadata->>'size')::bigint into v_size from storage.objects where bucket_id='proofpay-evidence' and name=v_item->>'storage_path';
   if not found or v_size is null then raise exception 'File upload is incomplete. Retry the upload.'; end if;
   insert into public.evidence_artifacts(submission_id,kind,label,storage_path,size_bytes) values(v_s.id,'file',v_item->>'label',v_item->>'storage_path',v_size);
  elsif v_item->>'kind'='url' then
   insert into public.evidence_artifacts(submission_id,kind,label,url) values(v_s.id,'url',v_item->>'label',v_item->>'url');
  else raise exception 'Unsupported evidence type'; end if;
 end loop;
 update public.evidence_submissions set status='submitted',notes=coalesce(p_notes,''),submitted_at=now() where id=v_s.id;
 return v_s.id;
end;$$;

create function public.review_evidence(p_submission_id uuid,p_decision text,p_note text,p_confirmed_criteria uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_s public.evidence_submissions%rowtype;v_latest uuid;v_required integer;v_confirmed integer;
begin
 select * into v_s from public.evidence_submissions where id=p_submission_id;
 if not found or not proofpay_private.is_client(v_s.project_id) then raise exception 'Only the project client can review' using errcode='42501'; end if;
 perform proofpay_private.lock_handoff_milestone(v_s.milestone_id);
 select * into v_s from public.evidence_submissions where id=p_submission_id;
 if v_s.status<>'submitted' then raise exception 'This submission has already been reviewed or is incomplete'; end if;
 select id into v_latest from public.evidence_submissions where milestone_id=v_s.milestone_id order by revision desc limit 1;
 if v_latest<>v_s.id then raise exception 'Review the latest submission'; end if;
 if p_decision not in ('approved','changes') or p_decision is null then raise exception 'Choose approve or request changes'; end if;
 if p_note is null or char_length(btrim(p_note))=0 then raise exception 'Add a review note'; end if;
 select count(*) into v_required from public.acceptance_criteria where milestone_id=v_s.milestone_id;
 select count(*) into v_confirmed from public.acceptance_criteria where milestone_id=v_s.milestone_id and id=any(coalesce(p_confirmed_criteria,'{}'));
 if v_confirmed<>cardinality(coalesce(p_confirmed_criteria,'{}')) then raise exception 'Invalid or duplicate criterion'; end if;
 if p_decision='approved' and (v_confirmed<>v_required or v_required=0) then raise exception 'Confirm every acceptance criterion before approving'; end if;
 insert into public.submission_reviews(submission_id,reviewed_by,decision,note,confirmed_criteria)
 values(v_s.id,auth.uid(),p_decision,btrim(p_note),coalesce(p_confirmed_criteria,'{}'));
 update public.evidence_submissions set status=p_decision where id=v_s.id;
 return v_s.id;
end;$$;
revoke all on function proofpay_private.lock_handoff_milestone(uuid),proofpay_private.can_upload_evidence(text),proofpay_private.can_read_evidence(text) from public,anon,authenticated;
grant execute on function proofpay_private.can_upload_evidence(text),proofpay_private.can_read_evidence(text) to authenticated;
revoke all on function public.create_submission_link(uuid,text),public.revoke_submission_link(uuid),public.begin_evidence_submission(uuid),public.submit_evidence(uuid,text,jsonb),public.review_evidence(uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.create_submission_link(uuid,text),public.revoke_submission_link(uuid),public.begin_evidence_submission(uuid),public.submit_evidence(uuid,text,jsonb),public.review_evidence(uuid,text,text,uuid[]) to authenticated;
commit;
