-- ProofPay 005: recheck payment eligibility between preparation and lease acquisition.
-- Apply only after disposable SQL tests and explicit administrator approval.
begin;
create or replace function public.claim_paypal_payment(p_id uuid,p_lease uuid,p_create boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype; may_create boolean:=false; v_project_id uuid;
begin
 -- Match the project-before-payment lock order used by preparation and agreement changes.
 select pay.project_id into v_project_id from public.payments pay where pay.id=p_id;
 perform 1 from public.projects where id=v_project_id for update;
 select * into p from public.payments where id=p_id for update;
 if p_create and p.id is not null then
  if not exists(select 1 from public.projects pr where pr.id=p.project_id and pr.status<>'archived')
   or p.agreement_id is distinct from (select a.id from public.agreements a where a.project_id=p.project_id order by a.version desc limit 1)
   or not exists(select 1 from public.project_members pm where pm.project_id=p.project_id and pm.user_id=p.freelancer_id and pm.role='freelancer')
   or not exists(select 1 from public.project_members pm where pm.project_id=p.project_id and pm.user_id=p.payer_id and pm.role='client')
   or not exists(select 1 from public.agreement_approvals aa where aa.agreement_id=p.agreement_id and aa.user_id=p.payer_id and aa.role='client')
   or not exists(select 1 from public.agreement_approvals aa where aa.agreement_id=p.agreement_id and aa.user_id=p.freelancer_id and aa.role='freelancer')
   or p.submission_id is distinct from (select s.id from public.evidence_submissions s where s.milestone_id=p.milestone_id order by s.revision desc limit 1)
   or not exists(select 1 from public.evidence_submissions s join public.submission_reviews r on r.submission_id=s.id
     where s.id=p.submission_id and s.status='approved' and s.submitted_by=p.freelancer_id and r.decision='approved' and r.reviewed_by=p.payer_id)
  then raise exception 'PAYMENT_APPROVAL_REQUIRED'; end if;
  if not exists(select 1 from public.paypal_merchant_bindings b where b.id=p.merchant_binding_id and b.active and b.verified_at is not null
    and b.freelancer_id=p.freelancer_id and b.merchant_id=p.merchant_id and b.merchant_email=p.merchant_email and b.credential_fingerprint=p.credential_fingerprint)
  then raise exception 'PAYMENT_MERCHANT_NOT_CONFIGURED'; end if;
 end if;
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

revoke all on function public.claim_paypal_payment(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_paypal_payment(uuid,uuid,boolean) to service_role;
commit;

