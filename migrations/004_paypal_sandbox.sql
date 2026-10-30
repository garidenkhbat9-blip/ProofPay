-- Forward-only. Apply ONCE after 001-003. No existing records are rewritten.
-- No merchant is enabled automatically. Ownership must be verified by an admin.
begin;

create table public.paypal_merchant_bindings (
 id uuid primary key default gen_random_uuid(),
 freelancer_id uuid not null references public.profiles(id),
 merchant_id text not null check(merchant_id ~ '^[A-Z0-9]{13}$'),
 merchant_email text not null check(merchant_email=lower(btrim(merchant_email))),
 credential_fingerprint text not null check(credential_fingerprint ~ '^[a-f0-9]{64}$'),
 environment text not null default 'sandbox' check(environment='sandbox'),
 active boolean not null default false,
 verified_at timestamptz,
 verification_note text not null default '',
 created_at timestamptz not null default now(),
 unique(merchant_id,credential_fingerprint),
 check(not active or (verified_at is not null and char_length(btrim(verification_note))>0))
);
create unique index paypal_one_active_freelancer on public.paypal_merchant_bindings(freelancer_id) where active;

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 milestone_id uuid not null unique references public.milestones(id),
 agreement_id uuid not null references public.agreements(id),
 submission_id uuid not null references public.evidence_submissions(id),
 merchant_binding_id uuid not null references public.paypal_merchant_bindings(id),
 freelancer_id uuid not null references public.profiles(id),
 payer_id uuid not null references public.profiles(id),
 payer_email text not null,
 merchant_id text not null,
 merchant_email text not null,
 credential_fingerprint text not null,
 environment text not null default 'sandbox' check(environment='sandbox'),
 amount numeric(12,2) not null check(amount>0),
 currency text not null check(currency='USD'),
 operation_id uuid not null unique default gen_random_uuid(),
 invoice_number text not null unique check(char_length(invoice_number)<=25),
 paypal_invoice_id text unique,
 status text not null default 'NOT_STARTED' check(status in ('NOT_STARTED','CREATING','DRAFT','UNPAID','PAYMENT_PENDING','PAID','FAILED','CANCELLED','REFUNDED','REQUIRES_ATTENTION')),
 provider_status text,
 provider_updated_at timestamptz,
 checkout_url text,
 create_attempted_at timestamptz,
 create_retry_allowed boolean not null default false,
 lease_token uuid,
 lease_until timestamptz,
 last_verified_at timestamptz,
 paid_at timestamptz,
 cancelled_at timestamptz,
 refunded_at timestamptz,
 reconciliation_status text not null default 'NEVER_CHECKED' check(reconciliation_status in ('NEVER_CHECKED','SYNCED','ERROR','REQUIRES_ATTENTION')),
 last_error jsonb,
 provider_snapshot jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(payer_id<>freelancer_id),
 check(status not in ('PAID','REFUNDED') or (paypal_invoice_id is not null and last_verified_at is not null))
);
create index payments_project_idx on public.payments(project_id);

create table public.payment_history (
 id bigint generated always as identity primary key,
 payment_id uuid not null references public.payments(id),
 project_id uuid not null references public.projects(id),
 status text not null,
 provider_status text,
 source text not null check(source in ('api','webhook','reconcile')),
 created_at timestamptz not null default now()
);
create table public.paypal_webhook_events (
 event_id text primary key check(char_length(event_id)<=100),
 event_type text not null,
 invoice_id text,
 payload_sha256 text not null,
 verified_event jsonb not null,
 state text not null default 'RECEIVED' check(state in ('RECEIVED','PROCESSED','FAILED','IGNORED')),
 attempts integer not null default 0,
 last_error jsonb,
 received_at timestamptz not null default now(),
 processed_at timestamptz
);

alter table public.paypal_merchant_bindings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_history enable row level security;
alter table public.paypal_webhook_events enable row level security;
revoke all on public.paypal_merchant_bindings,public.payments,public.payment_history,public.paypal_webhook_events from public,anon,authenticated;
grant all on public.paypal_merchant_bindings,public.payments,public.payment_history,public.paypal_webhook_events to service_role;
grant usage,select on sequence public.payment_history_id_seq to service_role;
grant select(id,project_id,milestone_id,agreement_id,submission_id,freelancer_id,payer_id,amount,currency,invoice_number,paypal_invoice_id,status,provider_status,checkout_url,create_retry_allowed,last_verified_at,paid_at,cancelled_at,refunded_at,reconciliation_status,last_error,created_at,updated_at) on public.payments to authenticated;
grant select on public.payment_history to authenticated;
create policy payments_member_read on public.payments for select to authenticated using(proofpay_private.is_member(project_id));
create policy payment_history_member_read on public.payment_history for select to authenticated using(proofpay_private.is_member(project_id));

-- Service-only: actor is taken from server-verified Supabase Auth, never browser JSON.
create function public.prepare_paypal_payment(p_actor uuid,p_project uuid,p_milestone uuid,p_merchant text,p_fingerprint text)
returns public.payments language plpgsql security definer set search_path='' as $$
declare
 m public.milestones%rowtype; a public.agreements%rowtype; p public.projects%rowtype;
 b public.paypal_merchant_bindings%rowtype; s public.evidence_submissions%rowtype;
 result public.payments%rowtype; client_id uuid; worker_id uuid; email text; op uuid:=gen_random_uuid();
begin
 select * into m from public.milestones where id=p_milestone;
 select * into a from public.agreements where id=m.agreement_id;
 if a.project_id is distinct from p_project then raise exception 'PAYMENT_UNAUTHORIZED' using errcode='42501'; end if;
 select * into p from public.projects where id=a.project_id for update;
 select user_id into worker_id from public.project_members where project_id=p.id and role='freelancer';
 select user_id into client_id from public.project_members where project_id=p.id and role='client';
 if p_actor is null or worker_id is distinct from p_actor or p.id is null then raise exception 'PAYMENT_UNAUTHORIZED' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'PAYMENT_UNAUTHORIZED' using errcode='42501'; end if;
 if p.status='archived' or a.id is distinct from (select id from public.agreements where project_id=p.id order by version desc limit 1) then raise exception 'PAYMENT_APPROVAL_REQUIRED'; end if;
 if not exists(select 1 from public.agreement_approvals where agreement_id=a.id and user_id=client_id and role='client')
 or not exists(select 1 from public.agreement_approvals where agreement_id=a.id and user_id=worker_id and role='freelancer') then raise exception 'PAYMENT_APPROVAL_REQUIRED'; end if;
 select * into s from public.evidence_submissions where milestone_id=m.id order by revision desc limit 1;
 if s.id is null or s.status<>'approved' or s.submitted_by<>worker_id or not exists(select 1 from public.submission_reviews where submission_id=s.id and decision='approved' and reviewed_by=client_id) then raise exception 'PAYMENT_APPROVAL_REQUIRED'; end if;
 select * into b from public.paypal_merchant_bindings where freelancer_id=worker_id and merchant_id=p_merchant and credential_fingerprint=p_fingerprint and active and verified_at is not null;
 if b.id is null then raise exception 'PAYMENT_MERCHANT_NOT_CONFIGURED'; end if;
 select lower(btrim(u.email)) into email from auth.users u where u.id=client_id and u.email_confirmed_at is not null;
 if email is null or email=b.merchant_email or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'PAYPAL_INVALID_RECIPIENT'; end if;
 if p.currency<>'USD' then raise exception 'PAYPAL_CURRENCY_UNSUPPORTED'; end if;
 if m.amount<=0 then raise exception 'PAYPAL_INVALID_AMOUNT'; end if;
 select * into result from public.payments where milestone_id=m.id;
 if result.id is not null then return result; end if;
 insert into public.payments(project_id,milestone_id,agreement_id,submission_id,merchant_binding_id,freelancer_id,payer_id,payer_email,merchant_id,merchant_email,credential_fingerprint,amount,currency,operation_id,invoice_number)
 values(p.id,m.id,a.id,s.id,b.id,worker_id,client_id,email,b.merchant_id,b.merchant_email,b.credential_fingerprint,m.amount,p.currency,op,'PP-'||substr(replace(op::text,'-',''),1,22)) returning * into result;
 return result;
end; $$;

-- A durable first-attempt marker is committed BEFORE the provider POST.
-- Crashes/timeouts never authorize a second create; they require search/recovery.
create function public.claim_paypal_payment(p_id uuid,p_lease uuid,p_create boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype; may_create boolean:=false;
begin
 select * into p from public.payments where id=p_id for update;
 if p.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
 if p.lease_until>now() then raise exception 'PAYMENT_BUSY'; end if;
 if p.last_verified_at>now()-interval '5 seconds' and not p_create then raise exception 'PAYMENT_BUSY'; end if;
 may_create:=p_create and (p.create_attempted_at is null or p.create_retry_allowed) and p.paypal_invoice_id is null;
 update public.payments set lease_token=p_lease,lease_until=now()+interval '180 seconds',
 create_attempted_at=case when may_create then coalesce(create_attempted_at,now()) else create_attempted_at end,
 create_retry_allowed=case when may_create then false else create_retry_allowed end,
 status=case when may_create then 'CREATING' else status end,updated_at=now()
 where id=p_id returning * into p;
 return jsonb_build_object('payment',to_jsonb(p),'may_create',may_create);
end; $$;

create function public.attach_paypal_invoice(p_id uuid,p_lease uuid,p_invoice text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_invoice !~ '^INV2-[A-Z0-9-]{10,30}$' then raise exception 'PAYMENT_INVOICE_INVALID'; end if;
 update public.payments set paypal_invoice_id=p_invoice,updated_at=now() where id=p_id and lease_token=p_lease and lease_until>now() and (paypal_invoice_id is null or paypal_invoice_id=p_invoice);
 if not found then raise exception 'PAYMENT_LEASE_LOST'; end if;
end; $$;

create function public.finish_paypal_payment(p_id uuid,p_lease uuid,p_status text,p_provider_status text,p_url text,p_snapshot jsonb,p_source text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype;
begin
 select * into p from public.payments where id=p_id and lease_token=p_lease and lease_until>now() for update;
 if p.id is null then raise exception 'PAYMENT_LEASE_LOST'; end if;
 if p.paypal_invoice_id is null or p_snapshot->>'id' is distinct from p.paypal_invoice_id then raise exception 'PAYMENT_INVOICE_INVALID'; end if;
 if (p_snapshot->>'updated_at')::timestamptz<p.provider_updated_at then raise exception 'PAYMENT_STALE_SNAPSHOT'; end if;
 if ((p.status='PAID' or p.paid_at is not null) and p_status not in ('PAID','REFUNDED','REQUIRES_ATTENTION')) or ((p.status='REFUNDED' or p.refunded_at is not null) and p_status<>'REFUNDED') then p_status:='REQUIRES_ATTENTION'; end if;
 update public.payments set status=p_status,provider_status=p_provider_status,checkout_url=case when p_status='UNPAID' then p_url else null end,
 provider_snapshot=p_snapshot,provider_updated_at=coalesce((p_snapshot->>'updated_at')::timestamptz,provider_updated_at),last_verified_at=now(),updated_at=now(),last_error=null,
 reconciliation_status=case when p_status='REQUIRES_ATTENTION' then 'REQUIRES_ATTENTION' else 'SYNCED' end,
 paid_at=case when p_status='PAID' then coalesce(paid_at,now()) else paid_at end,
 cancelled_at=case when p_status='CANCELLED' then coalesce(cancelled_at,now()) else cancelled_at end,
 refunded_at=case when p_status='REFUNDED' then coalesce(refunded_at,now()) else refunded_at end,
 lease_token=null,lease_until=null where id=p_id;
 if p.status<>p_status or p.provider_status is distinct from p_provider_status then
 insert into public.payment_history(payment_id,project_id,status,provider_status,source) values(p.id,p.project_id,p_status,p_provider_status,p_source);
 end if;
end; $$;

create function public.fail_paypal_payment(p_id uuid,p_lease uuid,p_error jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.payments set last_error=p_error,reconciliation_status='ERROR',checkout_url=null,updated_at=now(),lease_token=null,lease_until=null,
 create_retry_allowed=coalesce(paypal_invoice_id is null and p_error->>'operation'='create_invoice' and p_error->>'code' in ('PAYPAL_AUTH_FAILED','PAYPAL_PERMISSION_DENIED'),false),
 status=case when paypal_invoice_id is null and p_error->>'operation'='create_invoice' and p_error->>'code' in ('PAYPAL_AUTH_FAILED','PAYPAL_PERMISSION_DENIED') then 'FAILED'
 when status in ('NOT_STARTED','CREATING') or p_error->>'code' in ('PAYPAL_PAYMENT_NOT_CONFIRMED','PAYPAL_INVALID_AMOUNT','PAYPAL_CURRENCY_UNSUPPORTED') then 'REQUIRES_ATTENTION' else status end
 where id=p_id and lease_token=p_lease;
 if not found then raise exception 'PAYMENT_LEASE_LOST'; end if;
end; $$;

create function proofpay_private.preserve_payment_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.project_id,new.milestone_id,new.agreement_id,new.submission_id,new.merchant_binding_id,new.freelancer_id,new.payer_id,new.payer_email,new.merchant_id,new.merchant_email,new.credential_fingerprint,new.environment,new.amount,new.currency,new.operation_id,new.invoice_number)
 is distinct from row(old.project_id,old.milestone_id,old.agreement_id,old.submission_id,old.merchant_binding_id,old.freelancer_id,old.payer_id,old.payer_email,old.merchant_id,old.merchant_email,old.credential_fingerprint,old.environment,old.amount,old.currency,old.operation_id,old.invoice_number)
 or (old.paypal_invoice_id is not null and new.paypal_invoice_id is distinct from old.paypal_invoice_id)
 or (old.create_attempted_at is not null and new.create_attempted_at is distinct from old.create_attempted_at)
 then raise exception 'PAYMENT_SNAPSHOT_IMMUTABLE'; end if;
 return new;
end; $$;
create trigger payment_snapshot_immutable before update on public.payments for each row execute function proofpay_private.preserve_payment_snapshot();
revoke all on function proofpay_private.preserve_payment_snapshot() from public,anon,authenticated;
revoke all on function public.prepare_paypal_payment(uuid,uuid,uuid,text,text),public.claim_paypal_payment(uuid,uuid,boolean),public.attach_paypal_invoice(uuid,uuid,text),public.finish_paypal_payment(uuid,uuid,text,text,text,jsonb,text),public.fail_paypal_payment(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_paypal_payment(uuid,uuid,uuid,text,text),public.claim_paypal_payment(uuid,uuid,boolean),public.attach_paypal_invoice(uuid,uuid,text),public.finish_paypal_payment(uuid,uuid,text,text,text,jsonb,text),public.fail_paypal_payment(uuid,uuid,jsonb) to service_role;
commit;
