create table if not exists public.trial_rate_limits (
    ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
    claimed_at timestamptz not null default now()
);

alter table public.trial_rate_limits enable row level security;
revoke all on table public.trial_rate_limits from public, anon, authenticated;

create or replace function public.claim_trial_slot(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    did_claim boolean;
begin
    if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
        return false;
    end if;

    insert into public.trial_rate_limits (ip_hash, claimed_at)
    values (p_ip_hash, now())
    on conflict (ip_hash) do update
        set claimed_at = now()
        where public.trial_rate_limits.claimed_at < now() - interval '30 days'
    returning true into did_claim;

    return coalesce(did_claim, false);
end;
$$;

revoke all on function public.claim_trial_slot(text) from public, anon, authenticated;
grant execute on function public.claim_trial_slot(text) to service_role;
