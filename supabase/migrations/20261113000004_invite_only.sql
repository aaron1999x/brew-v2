-- Invite-only alpha: verbatim from docs/phase-5-roadmap.md §4, plus handle_new_user() from the M0 prompt Appendix 2.

create table public.app_config (
  key   text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values ('invite_only', 'true'::jsonb);

create table public.signup_allowlist (
  email      citext primary key,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_config       enable row level security;
alter table public.signup_allowlist enable row level security;

create policy app_config_read  on public.app_config for select using (true);
create policy app_config_admin on public.app_config for all using (public.is_admin()) with check (public.is_admin());
create policy allowlist_admin  on public.signup_allowlist for all using (public.is_admin()) with check (public.is_admin());

-- Friendly check before calling supabase.auth.signUp
create or replace function public.can_sign_up(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value::text <> 'true' from public.app_config where key = 'invite_only'), true)
      or exists (select 1 from public.signup_allowlist where email = lower(p_email)::citext);
$$;
grant execute on function public.can_sign_up to anon, authenticated;

-- Enforcement: add to the top of public.handle_new_user()
--   if not public.can_sign_up(new.email) then
--     raise exception 'invite_only' using errcode = 'P0001';
--   end if;

-- Appendix 2 of the M0 prompt: handle_new_user() with the invite-only check at the top.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted    citext := lower(coalesce(new.raw_user_meta_data->>'handle', ''));
  chosen    citext;
  confirmed boolean := true;
begin
  if not public.can_sign_up(new.email) then
    raise exception 'invite_only' using errcode = 'P0001';
  end if;

  if wanted ~ '^[a-z0-9_]{3,30}$'
     and not exists (select 1 from public.reserved_handles where handle = wanted)
     and not exists (select 1 from public.profiles where handle = wanted)
     and not exists (select 1 from public.handle_history where old_handle = wanted) then
    chosen := wanted;
  else
    chosen := 'brewer_' || substr(replace(new.id::text, '-', ''), 1, 10);
    confirmed := false;
  end if;

  insert into public.profiles (id, handle, handle_confirmed, display_name)
  values (
    new.id, chosen, confirmed,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''), 'Brewer')
  );
  insert into public.account_status (user_id) values (new.id);
  insert into public.user_settings (user_id, time_zone)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'time_zone', ''), 'UTC'));
  return new;
end $$;