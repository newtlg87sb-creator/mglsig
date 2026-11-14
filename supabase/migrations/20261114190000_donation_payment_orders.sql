begin;

create table if not exists public.donation_orders (
    order_id uuid primary key,
    price_amount numeric not null check (price_amount > 0),
    price_currency text not null check (lower(price_currency) = 'usd'),
    pay_currency text not null check (lower(pay_currency) = 'usdtbsc'),
    invoice_id text unique,
    payment_id text unique,
    status text not null default 'pending'
        check (status in ('pending', 'paid', 'cancelled')),
    created_at timestamptz not null default now(),
    processed_at timestamptz
);

alter table public.donation_orders enable row level security;
revoke all on table public.donation_orders from public, anon, authenticated;
grant all on table public.donation_orders to service_role;

create or replace function public.process_donation_order_payment(
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
    donation_order public.donation_orders%rowtype;
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
    into donation_order
    from public.donation_orders
    where order_id = p_order_id
    for update;

    if not found then
        raise exception 'Donation order not found';
    end if;

    if donation_order.status = 'paid' then
        if donation_order.invoice_id = p_invoice_id
           and donation_order.payment_id = p_payment_id
           and donation_order.price_amount = p_paid_amount
           and lower(donation_order.price_currency) = lower(p_paid_currency)
           and lower(donation_order.pay_currency) = lower(p_pay_currency) then
            return false;
        end if;
        raise exception 'Payment does not match the recorded donation';
    end if;

    if donation_order.status <> 'pending'
       or donation_order.invoice_id <> p_invoice_id
       or donation_order.price_amount <> p_paid_amount
       or lower(donation_order.price_currency) <> lower(p_paid_currency)
       or lower(donation_order.pay_currency) <> lower(p_pay_currency) then
        raise exception 'Payment does not match the donation order';
    end if;

    update public.donation_orders
    set status = 'paid',
        payment_id = p_payment_id,
        processed_at = pg_catalog.now()
    where order_id = p_order_id;

    return true;
end;
$$;

revoke all on function public.process_donation_order_payment(uuid, text, text, numeric, text, text)
    from public, anon, authenticated;
grant execute on function public.process_donation_order_payment(uuid, text, text, numeric, text, text)
    to service_role;

commit;
