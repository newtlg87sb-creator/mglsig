begin;

alter table public.subscription_orders
    drop constraint if exists subscription_orders_plan_check;
alter table public.subscription_orders
    drop constraint if exists subscription_orders_plan_allowed;
alter table public.subscription_orders
    add constraint subscription_orders_plan_allowed
        check (plan in ('alpha', 'beta', 'gamma'));

create table if not exists public.gamma_subscription_payments (
    payment_id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    processed_at timestamptz not null default now()
);

alter table public.gamma_subscription_payments enable row level security;
revoke all on table public.gamma_subscription_payments from public, anon, authenticated;
grant all on table public.gamma_subscription_payments to service_role;

create or replace function public.activate_subscription_order(
    p_order_id uuid,
    p_invoice_id text,
    p_payment_id text,
    p_paid_amount numeric,
    p_paid_currency text,
    p_pay_currency text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    subscription_order public.subscription_orders%rowtype;
begin
    if p_order_id is null
       or p_invoice_id is null
       or p_payment_id is null
       or length(p_payment_id) = 0
       or p_paid_amount is null
       or p_paid_currency is null
       or p_pay_currency is null then
        raise exception 'Payment details are required';
    end if;

    select *
    into subscription_order
    from public.subscription_orders
    where order_id = p_order_id
    for update;

    if not found then
        raise exception 'Subscription order not found';
    end if;

    if subscription_order.status = 'paid' then
        return false;
    end if;

    if subscription_order.status <> 'pending'
       or subscription_order.invoice_id <> p_invoice_id
       or subscription_order.price_amount <> p_paid_amount
       or lower(subscription_order.price_currency) <> lower(p_paid_currency)
       or lower(subscription_order.pay_currency) <> lower(p_pay_currency) then
        raise exception 'Payment does not match the subscription order';
    end if;

    update public.subscription_orders
    set status = 'paid',
        payment_id = p_payment_id,
        processed_at = pg_catalog.now()
    where order_id = p_order_id;

    if subscription_order.plan = 'alpha' then
        insert into public.alpha_subscription_payments (payment_id, user_id)
        values (p_payment_id, subscription_order.user_id);
    elsif subscription_order.plan = 'beta' then
        insert into public.beta_subscription_payments (payment_id, user_id)
        values (p_payment_id, subscription_order.user_id);
    else
        insert into public.gamma_subscription_payments (payment_id, user_id)
        values (p_payment_id, subscription_order.user_id);
    end if;

    update public."User control"
    set membership_expires_at = case
            when lower(membership_type) = subscription_order.plan
                 and membership_expires_at > pg_catalog.now()
                then membership_expires_at + interval '30 days'
            else pg_catalog.now() + interval '30 days'
        end,
        membership_type = subscription_order.plan,
        updated_at = pg_catalog.now()
    where id = subscription_order.user_id;

    if not found then
        raise exception 'User profile not found';
    end if;

    return true;
end;
$$;

do $$
declare
    existing_job record;
begin
    for existing_job in
        select jobid
        from cron.job
        where jobname = 'expire-paid-subscriptions'
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
            where lower(membership_type) in ('alpha', 'beta', 'gamma')
              and membership_expires_at is not null
              and membership_expires_at <= now();
        $job$
    );
end;
$$;

commit;
