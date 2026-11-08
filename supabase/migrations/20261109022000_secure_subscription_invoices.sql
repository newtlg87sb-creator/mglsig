begin;

create table if not exists public.subscription_orders (
    order_id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    plan text not null check (plan in ('alpha', 'beta')),
    price_amount numeric(12, 2) not null check (price_amount > 0),
    price_currency text not null check (lower(price_currency) = 'usd'),
    pay_currency text not null check (lower(pay_currency) = 'usdtbsc'),
    invoice_id text unique,
    payment_id text unique,
    status text not null default 'pending'
        check (status in ('pending', 'paid', 'cancelled')),
    created_at timestamptz not null default now(),
    processed_at timestamptz
);

alter table public.subscription_orders enable row level security;
revoke all on table public.subscription_orders from public, anon, authenticated;
grant all on table public.subscription_orders to service_role;

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

        update public."User control"
        set membership_expires_at = case
                when lower(membership_type) = 'alpha'
                     and membership_expires_at > pg_catalog.now()
                    then membership_expires_at + interval '30 days'
                else pg_catalog.now() + interval '30 days'
            end,
            membership_type = 'alpha',
            updated_at = pg_catalog.now()
        where id = subscription_order.user_id;
    else
        insert into public.beta_subscription_payments (payment_id, user_id)
        values (p_payment_id, subscription_order.user_id);

        update public."User control"
        set membership_expires_at = case
                when lower(membership_type) = 'beta'
                     and membership_expires_at > pg_catalog.now()
                    then membership_expires_at + interval '30 days'
                else pg_catalog.now() + interval '30 days'
            end,
            membership_type = 'beta',
            updated_at = pg_catalog.now()
        where id = subscription_order.user_id;
    end if;

    if not found then
        raise exception 'User profile not found';
    end if;

    return true;
end;
$$;

revoke all on function public.activate_subscription_order(uuid, text, text, numeric, text, text)
    from public, anon, authenticated;
grant execute on function public.activate_subscription_order(uuid, text, text, numeric, text, text)
    to service_role;

commit;
