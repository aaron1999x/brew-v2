-- M4: guided timer and brew log.
--   1. brews_before_write: the snapshot columns can't be edited after the insert
--   2. named checks on brews: flavours and "brewed_at not in the future"
--   3. log_brew: one transaction, idempotent on the device-generated brew id, optional quick-change version
--   4. my_recipe_brew_stats: brew counts and last-brewed dates for the caller

-- ---------------------------------------------------------------------
-- 1. Snapshots are written once, on insert
-- ---------------------------------------------------------------------
-- Before: an owner's update could rewrite recipe_id, the snapshots, is_others_recipe, source and
-- created_at (and, through dose_g_snapshot, fake the extraction yield). Now those columns are fixed
-- after the insert. The only allowed changes are the database's own "set null" when the author's
-- version or recipe row is gone (account deletion), as in M2.
create or replace function public.brews_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v   public.recipe_versions;
  r   public.recipes;
  p   public.profiles;
begin
  if tg_op = 'UPDATE' then
    if new.recipe_version_id is distinct from old.recipe_version_id
       and not (new.recipe_version_id is null
                and not exists (select 1 from public.recipe_versions where id = old.recipe_version_id)) then
      raise exception 'brew_version_immutable' using errcode = 'P0001';
    end if;

    if new.recipe_id is distinct from old.recipe_id
       and not (new.recipe_id is null
                and not exists (select 1 from public.recipes where id = old.recipe_id)) then
      raise exception 'immutable_field' using errcode = 'P0001';
    end if;

    if new.user_id                is distinct from old.user_id
       or new.recipe_name_snapshot    is distinct from old.recipe_name_snapshot
       or new.author_handle_snapshot  is distinct from old.author_handle_snapshot
       or new.version_no_snapshot     is distinct from old.version_no_snapshot
       or new.dose_g_snapshot         is distinct from old.dose_g_snapshot
       or new.is_others_recipe        is distinct from old.is_others_recipe
       or new.source                  is distinct from old.source
       or new.created_at              is distinct from old.created_at then
      raise exception 'immutable_field' using errcode = 'P0001';
    end if;
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

-- ---------------------------------------------------------------------
-- 2. Named checks
-- ---------------------------------------------------------------------
-- At most 12 flavour tags, each 1-30 characters after trimming, no duplicates ignoring case.
-- Executable by members only, like steps_shape_ok (check constraints run as the caller).
create or replace function public.brews_flavours_ok(p_tags text[])
returns boolean language sql immutable set search_path = public as $$
  select p_tags is not null
     and coalesce(array_length(p_tags, 1), 0) <= 12
     and not exists (select 1 from unnest(p_tags) t where char_length(btrim(t)) not between 1 and 30)
     and (select count(distinct lower(btrim(t))) from unnest(p_tags) t) = coalesce(array_length(p_tags, 1), 0);
$$;
revoke all on function public.brews_flavours_ok(text[]) from public, anon;
grant execute on function public.brews_flavours_ok(text[]) to authenticated;

-- Repair existing rows first (trim, cut to 30 characters, drop empties and duplicates, keep the
-- first 12) and say so, so the constraint can be added.
do $$
declare
  r     record;
  fixed text[];
  n     int := 0;
begin
  for r in select id, flavours from public.brews where not public.brews_flavours_ok(flavours) loop
    select coalesce(array_agg(t order by o), '{}') into fixed
    from (
      select t, o from (
        select distinct on (lower(t)) t, o
        from (select left(btrim(x), 30) as t, o from unnest(r.flavours) with ordinality as u(x, o)) s
        where t <> ''
        order by lower(t), o
      ) d
      order by o
      limit 12
    ) e;
    update public.brews set flavours = fixed where id = r.id;
    n := n + 1;
  end loop;
  if n > 0 then raise notice 'M4: repaired flavours on % brew row(s)', n; end if;
end $$;

alter table public.brews
  add constraint brews_flavours_valid check (public.brews_flavours_ok(flavours));

-- A brew can't be dated more than 5 minutes after the row was created (clocks drift a little).
-- Uses created_at, not now(), so the check is immutable and still holds on later edits.
alter table public.brews
  add constraint brews_brewed_at_not_future check (brewed_at <= created_at + interval '5 minutes');

-- ---------------------------------------------------------------------
-- 3. log_brew
-- ---------------------------------------------------------------------
-- Security invoker, so RLS and the triggers apply as the caller.
--   p_brew        the brew (whitelisted columns only; snapshots, EY and the lock come from the triggers)
--   p_new_version optional quick change: only grind_setting, temp_c, dose_g, brew_water_g, steps
--                 (target_g and per-pour temp_c only) and change_note may differ from the base version.
--                 It becomes version N+1 (through save_recipe) and the brew is logged against it.
-- Idempotent on p_brew->>'id': a retry returns the existing brew and creates nothing.
create or replace function public.log_brew(p_brew jsonb, p_new_version jsonb default null)
returns public.brews language plpgsql security invoker set search_path = public as $$
declare
  uid       uuid := (select auth.uid());
  brew_id   uuid;
  ver_id    uuid;
  wl        jsonb;
  b         public.brews;
  base      public.recipe_versions;
  rec       public.recipes;
  cand      public.recipe_versions;
  newv      public.recipe_versions;
  allowed_keys text[] := array['grind_setting', 'temp_c', 'dose_g', 'brew_water_g', 'steps', 'change_note'];
  note      text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_brew is null or jsonb_typeof(p_brew) <> 'object' then
    raise exception 'brew_not_found' using errcode = 'P0001';
  end if;

  brew_id := (p_brew ->> 'id')::uuid;
  ver_id  := (p_brew ->> 'recipe_version_id')::uuid;
  if brew_id is null then
    raise exception 'brew_not_found' using errcode = 'P0001';
  end if;
  if ver_id is null then
    raise exception 'version_not_found' using errcode = 'P0001';
  end if;

  -- Serialise retries of the same brew id, then return what is already there.
  perform pg_advisory_xact_lock(hashtextextended('brew:' || brew_id::text, 0));
  select * into b from public.brews where id = brew_id and user_id = uid;
  if found then
    return b;
  end if;

  select jsonb_object_agg(key, value) into wl
  from jsonb_each(p_brew)
  where key = any (array[
    'brewed_at', 'source', 'drawdown_s', 'beverage_g', 'tds_pct',
    'sweetness', 'acidity', 'brightness', 'body', 'clarity', 'balance', 'aftertaste', 'overall',
    'flavours', 'tasted_temp', 'tasted_after_min', 'notes', 'next_change', 'client_updated_at']);
  b := jsonb_populate_record(null::public.brews, coalesce(wl, '{}'::jsonb));

  if b.overall is null then
    raise exception 'overall_required' using errcode = 'P0001';
  end if;

  if p_new_version is not null then
    if jsonb_typeof(p_new_version) <> 'object'
       or exists (select 1 from jsonb_object_keys(p_new_version) k where k <> all (allowed_keys)) then
      raise exception 'quick_change_invalid' using errcode = 'P0001';
    end if;

    select * into base from public.recipe_versions where id = ver_id;
    if not found then
      raise exception 'version_not_found' using errcode = 'P0001';
    end if;
    select * into rec from public.recipes
    where id = base.recipe_id and owner_id = uid and deleted_at is null
    for update;
    if not found then
      raise exception 'version_not_found' using errcode = 'P0001';
    end if;

    note := btrim(coalesce(p_new_version ->> 'change_note', ''));
    if char_length(note) not between 1 and 200 then
      raise exception 'quick_change_invalid' using errcode = 'P0001';
    end if;

    if p_new_version ? 'steps' then
      -- Same steps in the same order; only pour targets and per-pour temperatures may move.
      if jsonb_typeof(p_new_version -> 'steps') <> 'array'
         or (select coalesce(jsonb_agg(s - 'target_g' - 'temp_c' order by o), '[]'::jsonb)
             from jsonb_array_elements(p_new_version -> 'steps') with ordinality as t(s, o))
            is distinct from
            (select coalesce(jsonb_agg(s - 'target_g' - 'temp_c' order by o), '[]'::jsonb)
             from jsonb_array_elements(base.steps) with ordinality as t(s, o)) then
        raise exception 'quick_change_invalid' using errcode = 'P0001';
      end if;
    end if;

    begin
      cand := jsonb_populate_record(base, p_new_version);
    exception when others then
      raise exception 'quick_change_invalid' using errcode = 'P0001';
    end;
    cand.change_note := note;

    if cand.grind_setting is not distinct from base.grind_setting
       and cand.temp_c is not distinct from base.temp_c
       and cand.dose_g is not distinct from base.dose_g
       and cand.brew_water_g is not distinct from base.brew_water_g
       and cand.steps is not distinct from base.steps then
      raise exception 'quick_change_invalid' using errcode = 'P0001';
    end if;

    -- Same code path as the editor's "save as new version".
    begin
      newv := public.save_recipe(rec.id, rec.name, rec.method, rec.method_custom, base.id, to_jsonb(cand), true);
    exception when check_violation or not_null_violation or numeric_value_out_of_range then
      raise exception 'quick_change_invalid' using errcode = 'P0001';
    end;
    ver_id := newv.id;
  end if;

  begin
    insert into public.brews (
      id, user_id, recipe_version_id, brewed_at, source,
      recipe_name_snapshot, version_no_snapshot, dose_g_snapshot,   -- filled by brews_before_write
      drawdown_s, beverage_g, tds_pct,
      sweetness, acidity, brightness, body, clarity, balance, aftertaste, overall,
      flavours, tasted_temp, tasted_after_min, notes, next_change, client_updated_at)
    values (
      brew_id, uid, ver_id, b.brewed_at, coalesce(b.source, 'manual'),
      null, null, null,
      b.drawdown_s, b.beverage_g, b.tds_pct,
      b.sweetness, b.acidity, b.brightness, b.body, b.clarity, b.balance, b.aftertaste, b.overall,
      coalesce(b.flavours, '{}'), b.tasted_temp, b.tasted_after_min, b.notes, b.next_change, b.client_updated_at)
    returning * into b;
  exception when unique_violation then
    -- The id belongs to someone else's row (invisible to us): never reveal or reuse it.
    raise exception 'brew_conflict' using errcode = 'P0001';
  end;

  return b;
end $$;

revoke all on function public.log_brew(jsonb, jsonb) from public, anon;
grant execute on function public.log_brew(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Brew counts and last-brewed dates
-- ---------------------------------------------------------------------
-- From the brews themselves (not recipe_counters / recipes.last_brewed_at, which a soft delete
-- never lowers). Per recipe and version; the app sums per recipe.
create or replace function public.my_recipe_brew_stats()
returns table (recipe_id uuid, recipe_version_id uuid, brew_count int, last_brewed_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select b.recipe_id, b.recipe_version_id, count(*)::int, max(b.brewed_at)
  from public.brews b
  where b.user_id = (select auth.uid())
    and b.deleted_at is null
    and b.recipe_id is not null
  group by b.recipe_id, b.recipe_version_id;
$$;

revoke all on function public.my_recipe_brew_stats() from public, anon;
grant execute on function public.my_recipe_brew_stats() to authenticated;
