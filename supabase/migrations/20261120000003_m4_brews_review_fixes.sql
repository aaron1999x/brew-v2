-- M4 Stage 1 review fixes.
--   1. brews_before_write: created_at is always the server's time on insert. A member inserting
--      directly (RLS allows it) could set created_at in the future and so get past
--      brews_brewed_at_not_future, which compares brewed_at with created_at.
--   2. log_brew: a quick change may move target_g and temp_c on pour steps only. Before, the
--      comparison stripped those keys from every step, so a change could add them to a swirl or wait.

-- ---------------------------------------------------------------------
-- 1. created_at set by the server on insert
-- ---------------------------------------------------------------------
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
    new.created_at             := now();
    new.updated_at             := now();
  end if;

  if new.tds_pct is not null and new.beverage_g is not null and new.dose_g_snapshot > 0 then
    new.ey_pct := round((new.tds_pct * new.beverage_g / new.dose_g_snapshot)::numeric, 1);
  else
    new.ey_pct := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. log_brew: only pour steps may change, and only target_g and temp_c
-- ---------------------------------------------------------------------
-- Same as 20261120000002 except the steps comparison. CREATE OR REPLACE keeps the grants
-- (members only; revoked from public and anon).
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
      -- Same steps in the same order. Pours may move target_g and temp_c; other steps can't change.
      if jsonb_typeof(p_new_version -> 'steps') <> 'array'
         or (select coalesce(jsonb_agg(case when s ->> 'kind' = 'pour' then s - 'target_g' - 'temp_c' else s end
                                       order by o), '[]'::jsonb)
             from jsonb_array_elements(p_new_version -> 'steps') with ordinality as t(s, o))
            is distinct from
            (select coalesce(jsonb_agg(case when s ->> 'kind' = 'pour' then s - 'target_g' - 'temp_c' else s end
                                       order by o), '[]'::jsonb)
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
