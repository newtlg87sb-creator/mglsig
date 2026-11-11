create table if not exists public.news_cache (
    cache_key text primary key,
    payload jsonb,
    fetched_at timestamptz,
    last_attempt_at timestamptz
);

alter table public.news_cache enable row level security;
revoke all on table public.news_cache from public, anon, authenticated;
grant select, insert, update on table public.news_cache to service_role;

create or replace function public.claim_news_refresh(
    p_cache_key text,
    p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    claimed_key text;
begin
    if p_cache_key <> 'cryptocompare_latest'
       or p_cooldown_seconds < 1
       or p_cooldown_seconds > 86400 then
        raise exception 'Invalid news refresh lock parameters';
    end if;

    insert into public.news_cache (cache_key, last_attempt_at)
    values (p_cache_key, now())
    on conflict (cache_key) do update
        set last_attempt_at = now()
        where public.news_cache.last_attempt_at
            <= now() - make_interval(secs => p_cooldown_seconds)
    returning cache_key into claimed_key;

    return claimed_key is not null;
end;
$$;

revoke all on function public.claim_news_refresh(text, integer) from public, anon, authenticated;
grant execute on function public.claim_news_refresh(text, integer) to service_role;
