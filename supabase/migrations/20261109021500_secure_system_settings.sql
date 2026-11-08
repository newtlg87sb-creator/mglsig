begin;

do $$
begin
    if to_regclass('public.system_settings') is not null then
        execute 'alter table public.system_settings enable row level security';
        execute 'revoke all on table public.system_settings from public, anon, authenticated';
        execute 'grant all on table public.system_settings to service_role';
        execute 'delete from public.system_settings where key = ''admin_password''';
    end if;
end;
$$;

drop function if exists public.verify_admin_password(text);
drop function if exists public.toggle_bot_status(text, text);
drop function if exists public.purge_system_data(text);

commit;
