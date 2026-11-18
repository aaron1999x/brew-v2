-- M3: gear defaults, favourite-gear sync, recipe integrity checks, save_recipe, catalogue gaps.
-- See docs/progress.md (M3) for the reasons behind each change.

-- =====================================================================
-- 1. Gear: one default per category, switched in one transaction
-- =====================================================================
-- Security invoker: RLS on gear_items applies, so only the caller's own items are visible.
create or replace function public.gear_set_default(p_item_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  item public.gear_items;
begin
  select * into item from public.gear_items
  where id = p_item_id and user_id = (select auth.uid());
  if not found then
    raise exception 'gear_not_found' using errcode = 'P0001';
  end if;

  -- Lock every item in the category (in a fixed order) so two calls can't both set a default.
  perform 1 from public.gear_items
  where user_id = item.user_id and category = item.category
  order by id
  for update;

  update public.gear_items set is_default = false
  where user_id = item.user_id and category = item.category and is_default and id <> item.id;

  update public.gear_items set is_default = true
  where id = item.id and not is_default;
end $$;

revoke all on function public.gear_set_default(uuid) from public, anon;
grant execute on function public.gear_set_default(uuid) to authenticated;

-- =====================================================================
-- 2. Favourite gear follows renames and deletes of the linked gear item
-- =====================================================================
-- profiles.favourite_gear entries: { "item_id", "category", "name" } where name is the real name
-- (catalogue name, else custom name; never the nickname). Legacy entries have no item_id and are
-- left alone. Only the item owner's profile is touched.
--
-- Account deletion: auth.users -> profiles -> gear_items cascades. By the time the gear rows are
-- deleted the profile row is already gone, so the trigger returns without doing anything
-- (M2's lesson: triggers that act during Postgres's own clean-up broke account deletion).
create or replace function public.gear_items_sync_favourites()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  real_name text;
begin
  if not exists (select 1 from public.profiles where id = old.user_id) then
    return null;
  end if;

  if tg_op = 'DELETE' then
    update public.profiles p
    set favourite_gear = coalesce((
      select jsonb_agg(t.e order by t.ord)
      from jsonb_array_elements(p.favourite_gear) with ordinality as t(e, ord)
      where (t.e ->> 'item_id') is distinct from old.id::text
    ), '[]'::jsonb)
    where p.id = old.user_id
      and exists (select 1 from jsonb_array_elements(p.favourite_gear) as f(e)
                  where f.e ->> 'item_id' = old.id::text);
    return null;
  end if;

  -- UPDATE
  select coalesce((select c.name from public.gear_catalog c where c.id = new.catalog_id), new.custom_name)
  into real_name;

  update public.profiles p
  set favourite_gear = (
    select jsonb_agg(
      case when t.e ->> 'item_id' = old.id::text
           then t.e || jsonb_build_object('name', real_name, 'category', new.category)
           else t.e end
      order by t.ord)
    from jsonb_array_elements(p.favourite_gear) with ordinality as t(e, ord)
  )
  where p.id = old.user_id
    and exists (select 1 from jsonb_array_elements(p.favourite_gear) as f(e)
                where f.e ->> 'item_id' = old.id::text);
  return null;
end $$;

create trigger gear_items_sync_favourites_update
  after update of catalog_id, custom_name, category on public.gear_items
  for each row
  when (old.catalog_id is distinct from new.catalog_id
        or old.custom_name is distinct from new.custom_name
        or old.category is distinct from new.category)
  execute function public.gear_items_sync_favourites();

create trigger gear_items_sync_favourites_delete
  after delete on public.gear_items
  for each row execute function public.gear_items_sync_favourites();

-- =====================================================================
-- 3. Steps shape check (the full rules: order, cumulative pours, labels, stay in Zod)
-- =====================================================================
-- Kept executable by everyone (default grant): check constraints run as the caller.
create or replace function public.steps_shape_ok(p_steps jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  s jsonb;
  k text;
  n numeric;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then return false; end if;
  if jsonb_array_length(p_steps) > 30 then return false; end if;

  for s in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(s) <> 'object' then return false; end if;

    -- id: non-empty string, at most 64 characters
    if jsonb_typeof(s -> 'id') is distinct from 'string'
       or char_length(s ->> 'id') not between 1 and 64 then
      return false;
    end if;

    -- kind
    if jsonb_typeof(s -> 'kind') is distinct from 'string' then return false; end if;
    k := s ->> 'kind';
    if k not in ('pour', 'wait', 'swirl', 'stir', 'press', 'other') then return false; end if;

    -- at_s: required whole number of seconds, 0 to 48 h
    if jsonb_typeof(s -> 'at_s') is distinct from 'number' then return false; end if;
    n := (s ->> 'at_s')::numeric;
    if n <> trunc(n) or n < 0 or n > 172800 then return false; end if;

    -- duration_s: optional whole number of seconds, 0 to 48 h
    if jsonb_typeof(s -> 'duration_s') is not null and jsonb_typeof(s -> 'duration_s') <> 'null' then
      if jsonb_typeof(s -> 'duration_s') <> 'number' then return false; end if;
      n := (s ->> 'duration_s')::numeric;
      if n <> trunc(n) or n < 0 or n > 172800 then return false; end if;
    end if;

    -- target_g: required on pours, cumulative scale weight in grams
    if k = 'pour' then
      if jsonb_typeof(s -> 'target_g') is distinct from 'number' then return false; end if;
      n := (s ->> 'target_g')::numeric;
      if n <= 0 or n > 3000 then return false; end if;
    end if;

    -- temp_c: optional, 0–100 or null
    if jsonb_typeof(s -> 'temp_c') is not null and jsonb_typeof(s -> 'temp_c') <> 'null' then
      if jsonb_typeof(s -> 'temp_c') <> 'number' then return false; end if;
      n := (s ->> 'temp_c')::numeric;
      if n < 0 or n > 100 then return false; end if;
    end if;

    -- rate_gps: optional, above 0 and at most 50, or null
    if jsonb_typeof(s -> 'rate_gps') is not null and jsonb_typeof(s -> 'rate_gps') <> 'null' then
      if jsonb_typeof(s -> 'rate_gps') <> 'number' then return false; end if;
      n := (s ->> 'rate_gps')::numeric;
      if n <= 0 or n > 50 then return false; end if;
    end if;

    -- label (≤ 60) and technique (≤ 120): optional strings or null
    if jsonb_typeof(s -> 'label') is not null and jsonb_typeof(s -> 'label') <> 'null' then
      if jsonb_typeof(s -> 'label') <> 'string' or char_length(s ->> 'label') > 60 then return false; end if;
    end if;
    if jsonb_typeof(s -> 'technique') is not null and jsonb_typeof(s -> 'technique') <> 'null' then
      if jsonb_typeof(s -> 'technique') <> 'string' or char_length(s ->> 'technique') > 120 then return false; end if;
    end if;
  end loop;

  return true;
end $$;

-- =====================================================================
-- 4. Integrity checks (named, so src/lib/errors/messages.ts can translate them)
-- =====================================================================
-- Staging had no recipe rows when this was written, so nothing needed fixing first.
alter table public.recipe_versions
  add constraint recipe_versions_steps_shape check (public.steps_shape_ok(steps)),
  add constraint recipe_versions_steps_schema check (steps_schema = 1),
  add constraint recipe_versions_bypass_consistent check ((bypass_g = 0) = (bypass_timing = 'none')),
  add constraint recipe_versions_drawdown_range
    check (drawdown_min_s is null or drawdown_max_s is null or drawdown_min_s <= drawdown_max_s),
  add constraint recipe_versions_tds_range
    check (tds_min is null or tds_max is null or tds_min <= tds_max),
  add constraint recipe_versions_ey_range
    check (ey_min is null or ey_max is null or ey_min <= ey_max);

alter table public.recipes
  add constraint recipes_method_custom_required
    check (method <> 'other' or nullif(trim(method_custom), '') is not null);

-- =====================================================================
-- 5. recipes.edited_at: "Last edited" and its sort. Set on create (default) and by save_recipe;
--    archive, restore and undo-delete don't move it (updated_at does).
-- =====================================================================
-- Existing rows (none on staging) get the time this migration runs.
alter table public.recipes add column edited_at timestamptz not null default now();

-- =====================================================================
-- 6. save_recipe: name/method and a version in one transaction
-- =====================================================================
-- Security invoker, so RLS and the lock guard (version_locked) apply.
--   p_as_new_version = true  -> inserts v(latest + 1) from p_version
--   p_as_new_version = false -> updates p_base_version_id's whitelisted columns from p_version
-- p_version holds every version column (a full replacement, like create_recipe's payload).
create or replace function public.save_recipe(
  p_recipe_id uuid,
  p_name text,
  p_method public.brew_method,
  p_method_custom text,
  p_base_version_id uuid,
  p_version jsonb,
  p_as_new_version boolean)
returns public.recipe_versions language plpgsql security invoker set search_path = public as $$
declare
  rec  public.recipes;
  base public.recipe_versions;
  v    public.recipe_versions;
begin
  select * into rec from public.recipes
  where id = p_recipe_id and owner_id = (select auth.uid()) and deleted_at is null
  for update;
  if not found then
    raise exception 'recipe_not_found' using errcode = 'P0001';
  end if;

  select * into base from public.recipe_versions
  where id = p_base_version_id and recipe_id = rec.id;
  if not found then
    raise exception 'version_not_found' using errcode = 'P0001';
  end if;

  update public.recipes
  set name = p_name, method = p_method, method_custom = p_method_custom, edited_at = now()
  where id = rec.id;

  v := jsonb_populate_record(null::public.recipe_versions, coalesce(p_version, '{}'::jsonb));

  if coalesce(p_as_new_version, false) then
    insert into public.recipe_versions (
      recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
      roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
      dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
      water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
    values (
      rec.id, rec.latest_version_no + 1, v.change_note, v.coffee_name, v.roaster, v.origin, v.process,
      v.varietal, v.altitude_m, v.roast_level, v.roast_date, v.colour_reading, v.colour_scale,
      coalesce(v.gear, '{}'::jsonb), v.brewer_catalog_id, v.grinder_catalog_id, v.dose_g, v.brew_water_g,
      coalesce(v.bypass_g, 0), coalesce(v.bypass_timing, 'none'), v.retention_ratio, v.temp_c,
      v.grind_setting, v.grind_microns, v.water_ppm, v.drawdown_min_s, v.drawdown_max_s, v.tds_min,
      v.tds_max, v.ey_min, v.ey_max, coalesce(v.steps_schema, 1), coalesce(v.steps, '[]'::jsonb), v.notes)
    returning * into v;

    update public.recipes set latest_version_id = v.id, latest_version_no = v.version_no
    where id = rec.id;
  else
    update public.recipe_versions set
      change_note        = v.change_note,
      coffee_name        = v.coffee_name,
      roaster            = v.roaster,
      origin             = v.origin,
      process            = v.process,
      varietal           = v.varietal,
      altitude_m         = v.altitude_m,
      roast_level        = v.roast_level,
      roast_date         = v.roast_date,
      colour_reading     = v.colour_reading,
      colour_scale       = v.colour_scale,
      gear               = coalesce(v.gear, '{}'::jsonb),
      brewer_catalog_id  = v.brewer_catalog_id,
      grinder_catalog_id = v.grinder_catalog_id,
      dose_g             = v.dose_g,
      brew_water_g       = v.brew_water_g,
      bypass_g           = coalesce(v.bypass_g, 0),
      bypass_timing      = coalesce(v.bypass_timing, 'none'),
      retention_ratio    = v.retention_ratio,
      temp_c             = v.temp_c,
      grind_setting      = v.grind_setting,
      grind_microns      = v.grind_microns,
      water_ppm          = v.water_ppm,
      drawdown_min_s     = v.drawdown_min_s,
      drawdown_max_s     = v.drawdown_max_s,
      tds_min            = v.tds_min,
      tds_max            = v.tds_max,
      ey_min             = v.ey_min,
      ey_max             = v.ey_max,
      steps_schema       = coalesce(v.steps_schema, 1),
      steps              = coalesce(v.steps, '[]'::jsonb),
      notes              = v.notes
    where id = base.id
    returning * into v;
  end if;

  return v;
end $$;

revoke all on function public.save_recipe(uuid, text, public.brew_method, text, uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_recipe(uuid, text, public.brew_method, text, uuid, jsonb, boolean)
  to authenticated;

-- =====================================================================
-- 7. Versions of a soft-deleted recipe can't be edited directly
-- =====================================================================
-- Triggers that write versions (brews_after_insert setting locked_at) and the account-deletion
-- cascade don't go through RLS, so they are unaffected.
drop policy recipe_versions_update on public.recipe_versions;
create policy recipe_versions_update on public.recipe_versions for update
  using (exists (select 1 from public.recipes r
                 where r.id = recipe_id and r.owner_id = (select auth.uid()) and r.deleted_at is null))
  with check (exists (select 1 from public.recipes r
                      where r.id = recipe_id and r.owner_id = (select auth.uid()) and r.deleted_at is null));

-- =====================================================================
-- 8. Gear catalogue gaps (acceptance methods and common SEA gear)
-- =====================================================================
insert into public.gear_catalog (category, brand, model) values
  -- brewers
  ('brewer', 'Espro', 'P7'),
  ('brewer', 'AeroPress', 'XL'),
  ('brewer', 'Hario', 'Mizudashi Cold Brew Pot'),
  -- filters
  ('filter', 'Kalita', 'Wave 155 Paper'),
  ('filter', 'AeroPress', 'XL Paper Filters'),
  ('filter', 'April', 'Paper Filters'),
  ('filter', 'Toddy', 'Felt Filters'),
  ('filter', 'Melitta', '#4 Cone Paper'),
  -- grinders
  ('grinder', 'Kingrinder', 'K4'),
  ('grinder', 'Timemore', 'Sculptor 078S'),
  ('grinder', 'Timemore', 'C3 ESP'),
  ('grinder', '1Zpresso', 'Q Air'),
  -- kettles
  ('kettle', 'Fellow', 'Stagg EKG Pro'),
  ('kettle', 'Fellow', 'Corvo EKG'),
  ('kettle', 'Hario', 'V60 Drip Kettle Air'),
  -- scales
  ('scale', 'Timemore', 'Black Mirror Nano'),
  ('scale', 'Acaia', 'Pyxis')
on conflict do nothing;
