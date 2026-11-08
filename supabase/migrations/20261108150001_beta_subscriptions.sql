create table if not exists public.beta_subscription_payments (
    payment_id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    processed_at timestamptz not null default now()
);

alter table public.beta_subscription_payments enable row level security;
revoke all on table public.beta_subscription_payments from public, anon, authenticated;
grant all on table public.beta_subscription_payments to service_role;

create or replace function public.activate_alpha_subscription(
    p_user_id uuid,
    p_payment_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    if p_user_id is null or p_payment_id is null or length(p_payment_id) = 0 then
        raise exception 'User ID and payment ID are required';
    end if;

    insert into public.alpha_subscription_payments (payment_id, user_id)
    values (p_payment_id, p_user_id)
    on conflict (payment_id) do nothing;

    if not found then
        return false;
    end if;

    update public."User control"
    set membership_expires_at = case
            when lower(membership_type) = 'alpha'
                 and membership_expires_at > pg_catalog.now()
                then membership_expires_at + interval '30 days'
            else pg_catalog.now() + interval '30 days'
        end,
        membership_type = 'alpha',
        updated_at = pg_catalog.now()
    where id = p_user_id;

    if not found then
        raise exception 'User profile not found';
    end if;

    return true;
end;
$$;

revoke all on function public.activate_alpha_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.activate_alpha_subscription(uuid, text) to service_role;

create or replace function public.activate_beta_subscription(
    p_user_id uuid,
    p_payment_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
    if p_user_id is null or p_payment_id is null or length(p_payment_id) = 0 then
        raise exception 'User ID and payment ID are required';
    end if;

    insert into public.beta_subscription_payments (payment_id, user_id)
    values (p_payment_id, p_user_id)
    on conflict (payment_id) do nothing;

    if not found then
        return false;
    end if;

    update public."User control"
    set membership_expires_at = case
            when lower(membership_type) = 'beta'
                 and membership_expires_at > pg_catalog.now()
                then membership_expires_at + interval '30 days'
            else pg_catalog.now() + interval '30 days'
        end,
        membership_type = 'beta',
        updated_at = pg_catalog.now()
    where id = p_user_id;

    if not found then
        raise exception 'User profile not found';
    end if;

    return true;
end;
$$;

revoke all on function public.activate_beta_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.activate_beta_subscription(uuid, text) to service_role;

do $$
declare
    existing_job record;
begin
    for existing_job in
        select jobid
        from cron.job
        where jobname in ('expire-alpha-subscriptions', 'expire-paid-subscriptions')
    loop
        perform cron.unschedule(existing_job.jobid);
    end loop;

    perform cron.schedule(
        'expire-paid-subscriptions',
        '*/15 * * * *',
        $job$
            update public."User control"
            set membership_type = 'free',
                updated_at = now()
            where lower(membership_type) in ('alpha', 'beta')
              and membership_expires_at is not null
              and membership_expires_at <= now();
        $job$
    );
end;
$$;
