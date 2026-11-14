-- M2: accounts, onboarding, profile, settings.
--
-- 1. user_settings: theme column; onboarding must be a JSON object.
-- 2. Reserved handles for routes that exist now.
-- 3. Handle rules in one place: handle_status() (live check) and handle_suggestions().
--    handle_new_user() and profiles_handle_guard() now follow the same rules
--    (90-day history window, named errors instead of constraint errors).
-- 4. Invites: admin_list_invites(), admin_add_invite(), admin_remove_invite().
-- 5. Account deletion fixes: when a user is deleted, their recipe versions disappear and
--    Postgres sets other users' references to them to null. brews_before_write and
--    recipes_guard treated that as a forbidden change and stopped the delete. They now
--    allow a change to null only when the referenced version no longer exists.
-- 6. Avatars: owners can SELECT their own folder. Without it, the Storage API's upsert and
--    remove (which need SELECT as well as UPDATE/DELETE) can't reach the user's own file.
--    The update policy gets an explicit WITH CHECK (same rule as before).

-- ---------------------------------------------------------------------
-- 1. user_settings
-- ---------------------------------------------------------------------
alter table public.user_settings
  add column theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  add constraint user_settings_onboarding_object check (jsonb_typeof(onboarding) = 'object');

-- ---------------------------------------------------------------------
-- 2. Reserved handles
-- ---------------------------------------------------------------------
insert into public.reserved_handles (handle) values
  ('profile'), ('goodbye'), ('auth'), ('dev'), ('changelog'), ('status'), ('invites')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Handle rules
-- ---------------------------------------------------------------------

-- 'ok' | 'invalid' | 'reserved' | 'taken'. The signed-in user's own handle is 'ok'.
-- A handle someone else gave up less than 90 days ago is 'taken' (it still redirects to them).
create or replace function public.handle_status(p_handle text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if p_handle is null or p_handle !~ '^[a-z0-9_]{3,30}$' then
    return 'invalid';
  end if;
  if me is not null and exists (select 1 from public.profiles where id = me and handle = p_handle::citext) then
    return 'ok';
  end if;
  if exists (select 1 from public.reserved_handles where handle = p_handle::citext) then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where handle = p_handle::citext) then
    return 'taken';
  end if;
  if exists (select 1 from public.handle_history
             where old_handle = p_handle::citext
               and user_id is distinct from me
               and changed_at > now() - interval '90 days') then
    return 'taken';
  end if;
  return 'ok';
end $$;
revoke all on function public.handle_status(text) from public;
grant execute on function public.handle_status(text) to anon, authenticated;

-- Up to 3 free handles derived from p_base (a wanted handle or a display name).
create or replace function public.handle_suggestions(p_base text)
returns setof text language plpgsql volatile security definer set search_path = public as $$
declare
  me        uuid := auth.uid();
  base      text := left(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9_]', '', 'g'), 23);
  candidate text;
  found     int := 0;
  tried     text[] := '{}';
  i         int;
begin
  if base = '' then
    base := 'brewer';
  elsif char_length(base) < 3 then
    base := base || '_brews';
  end if;

  for i in 1 .. 23 loop
    candidate := case
      when i = 1 then base
      when i = 2 then base || '_brews'
      when i = 3 then base || '_coffee'
      when i <= 13 then base || (10 + floor(random() * 90))::int::text
      else base || (100 + floor(random() * 900))::int::text
    end;
    continue when candidate = any (tried);
    tried := tried || candidate;
    if public.handle_status(candidate) = 'ok'
       and not exists (select 1 from public.profiles where id = me and handle = candidate::citext) then
      return next candidate;
      found := found + 1;
      exit when found >= 3;
    end if;
  end loop;
end $$;
revoke all on function public.handle_suggestions(text) from public;
grant execute on function public.handle_suggestions(text) to anon, authenticated;

-- Sign-up trigger: invite-only check first (unchanged), then the same rules as handle_status()
-- (90-day history window instead of "ever"), and the display name cut to the 60-character limit
-- so a long name can't fail the whole sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted    citext := lower(coalesce(new.raw_user_meta_data->>'handle', ''));
  chosen    citext;
  confirmed boolean := true;
  v_name    text;
begin
  if not public.can_sign_up(new.email) then
    raise exception 'invite_only' using errcode = 'P0001';
  end if;

  if wanted ~ '^[a-z0-9_]{3,30}$'
     and not exists (select 1 from public.reserved_handles where handle = wanted)
     and not exists (select 1 from public.profiles where handle = wanted)
     and not exists (select 1 from public.handle_history
                     where old_handle = wanted and changed_at > now() - interval '90 days') then
    chosen := wanted;
  else
    chosen := 'brewer_' || substr(replace(new.id::text, '-', ''), 1, 10);
    confirmed := false;
  end if;

  v_name := left(btrim(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
                              nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'Brewer')), 60);

  insert into public.profiles (id, handle, handle_confirmed, display_name)
  values (new.id, chosen, confirmed, v_name);
  insert into public.account_status (user_id) values (new.id);
  insert into public.user_settings (user_id, time_zone)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'time_zone', ''), 'UTC'));
  return new;
end $$;

-- Handle change guard: named errors for every rule (the app maps them to messages).
create or replace function public.profiles_handle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.handle is distinct from old.handle then
    if new.handle is null or new.handle::text !~ '^[a-z0-9_]{3,30}$' then
      raise exception 'handle_invalid' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.reserved_handles where handle = new.handle) then
      raise exception 'handle_reserved' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.profiles where handle = new.handle and id <> new.id) then
      raise exception 'handle_taken' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.handle_history
               where old_handle = new.handle and user_id <> new.id
                 and changed_at > now() - interval '90 days') then
      raise exception 'handle_recently_used' using errcode = 'P0001';
    end if;
    if old.handle_confirmed then
      insert into public.handle_history (old_handle, user_id) values (old.handle, new.id)
      on conflict (old_handle) do update set user_id = excluded.user_id, changed_at = now();
    end if;
    new.handle_confirmed := true;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Invites (admins only)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_invites()
returns table (email citext, invited_at timestamptz, invited_by_handle citext, signed_up_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return query
    select a.email, a.created_at, p.handle, u.created_at
    from public.signup_allowlist a
    left join public.profiles p on p.id = a.invited_by
    left join auth.users u on lower(u.email) = lower(a.email::text)
    order by a.created_at desc, a.email;
end $$;

create or replace function public.admin_add_invite(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  addr text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if char_length(addr) > 254 or addr !~ '^[^@\s]+@[^@\s]+\.[^@\s.]+$' then
    raise exception 'email_invalid' using errcode = 'P0001';
  end if;
  insert into public.signup_allowlist (email, invited_by) values (addr, auth.uid())
  on conflict (email) do nothing;
end $$;

-- Only invites nobody has used yet can be removed.
create or replace function public.admin_remove_invite(p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(btrim(p_email))) then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  delete from public.signup_allowlist where email = lower(btrim(p_email))::citext;
end $$;

revoke all on function public.admin_list_invites(), public.admin_add_invite(text),
  public.admin_remove_invite(text) from public, anon;
grant execute on function public.admin_list_invites(), public.admin_add_invite(text),
  public.admin_remove_invite(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Account deletion: allow the database's own "set null" when a version is deleted
-- ---------------------------------------------------------------------
create or replace function public.brews_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v   public.recipe_versions;
  r   public.recipes;
  p   public.profiles;
begin
  -- A brew can't move to another version. The only allowed change is to null, and only when
  -- the version row is gone (the author deleted their account); the snapshots keep the log readable.
  if tg_op = 'UPDATE' and new.recipe_version_id is distinct from old.recipe_version_id
     and not (new.recipe_version_id is null
              and not exists (select 1 from public.recipe_versions where id = old.recipe_version_id)) then
    raise exception 'brew_version_immutable' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select * into v from public.recipe_versions where id = new.recipe_version_id;
    if not found then raise exception 'version_not_found' using errcode = 'P0001'; end if;
    select * into r from public.recipes where id = v.recipe_id;
    if r.owner_id <> new.user_id and not public.recipe_is_public(r.id) then
      raise exception 'recipe_not_available' using errcode = '42501';
    end if;
    select * into p from public.profiles where id = r.owner_id;
    new.recipe_id              := r.id;
    new.recipe_name_snapshot   := r.name;
    new.author_handle_snapshot := p.handle;
    new.version_no_snapshot    := v.version_no;
    new.dose_g_snapshot        := v.dose_g;
    new.is_others_recipe       := (r.owner_id <> new.user_id);
  end if;

  if new.tds_pct is not null and new.beverage_g is not null and new.dose_g_snapshot > 0 then
    new.ey_pct := round((new.tds_pct * new.beverage_g / new.dose_g_snapshot)::numeric, 1);
  else
    new.ey_pct := null;
  end if;
  return new;
end $$;

create or replace function public.recipes_guard()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  account_age interval;
  published_today int;
begin
  if (new.hidden_at is distinct from old.hidden_at or new.hidden_reason is distinct from old.hidden_reason)
     and not public.is_moderator() then
    raise exception 'moderator_only' using errcode = '42501';
  end if;

  -- forked_from_version_id may only become null when that version row is gone
  -- (the original author deleted their account).
  if new.slug is distinct from old.slug or new.owner_id is distinct from old.owner_id
     or new.is_copy is distinct from old.is_copy
     or (new.forked_from_version_id is distinct from old.forked_from_version_id
         and not (new.forked_from_version_id is null
                  and not exists (select 1 from public.recipe_versions where id = old.forked_from_version_id))) then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;

  if new.visibility = 'public' and old.visibility = 'private' then
    if not public.email_is_verified(new.owner_id) then
      raise exception 'email_not_verified' using errcode = 'P0001';
    end if;
    select now() - created_at into account_age from auth.users where id = new.owner_id;
    if account_age < interval '7 days' then
      select count(*) into published_today from public.publish_log
      where user_id = new.owner_id and created_at > now() - interval '24 hours';
      if published_today >= 5 then
        raise exception 'publish_limit' using errcode = 'P0001',
          hint = 'New accounts can publish 5 recipes a day.';
      end if;
    end if;
    new.published_at := coalesce(new.published_at, now());
    insert into public.publish_log (user_id, recipe_id) values (new.owner_id, new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. Avatars: owner can see (and so upsert/remove) files in their own folder
-- ---------------------------------------------------------------------
-- Public image URLs are served by the public bucket and don't use this policy.
create policy avatars_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter policy avatars_owner_update on storage.objects
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
