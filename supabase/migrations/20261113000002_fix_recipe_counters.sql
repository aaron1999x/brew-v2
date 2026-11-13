-- Fix: create_recipe (security invoker) inserted into recipe_counters, which has no insert policy,
-- so a normal member's call failed under RLS. Counter rows are now created by a security definer
-- trigger on recipes; create_recipe no longer inserts one, and copy_recipe tolerates the existing row.
-- See docs/progress.md (M0, deviations).

create or replace function public.recipes_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.recipe_counters (recipe_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger recipes_after_insert after insert on public.recipes
  for each row execute function public.recipes_after_insert();

-- Same as phase 1, without the recipe_counters insert (the trigger creates it).
create or replace function public.create_recipe(p_name text, p_method public.brew_method, p_method_custom text, p_version jsonb)
returns public.recipes language plpgsql security invoker set search_path = public as $$
declare
  rec public.recipes;
  ver public.recipe_versions;
begin
  insert into public.recipes (owner_id, slug, name, method, method_custom)
  values (auth.uid(), public.make_slug(auth.uid(), p_name), p_name, p_method, p_method_custom)
  returning * into rec;

  ver := jsonb_populate_record(null::public.recipe_versions, p_version);
  insert into public.recipe_versions (
    recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
  values (
    rec.id, 1, ver.change_note, ver.coffee_name, ver.roaster, ver.origin, ver.process, ver.varietal, ver.altitude_m,
    ver.roast_level, ver.roast_date, ver.colour_reading, ver.colour_scale, coalesce(ver.gear, '{}'::jsonb),
    ver.brewer_catalog_id, ver.grinder_catalog_id, ver.dose_g, ver.brew_water_g, coalesce(ver.bypass_g, 0),
    coalesce(ver.bypass_timing, 'none'), ver.retention_ratio, ver.temp_c, ver.grind_setting, ver.grind_microns,
    ver.water_ppm, ver.drawdown_min_s, ver.drawdown_max_s, ver.tds_min, ver.tds_max, ver.ey_min, ver.ey_max,
    coalesce(ver.steps_schema, 1), coalesce(ver.steps, '[]'::jsonb), ver.notes)
  returning * into ver;

  update public.recipes set latest_version_id = ver.id, latest_version_no = 1 where id = rec.id
  returning * into rec;
  return rec;
end $$;

-- Same as phase 1, except the new recipe's counters insert uses on conflict do nothing.
create or replace function public.copy_recipe(p_version_id uuid)
returns public.recipes language plpgsql security definer set search_path = public as $$
declare
  src_v public.recipe_versions;
  src_r public.recipes;
  rec   public.recipes;
  ver   public.recipe_versions;
  me    uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into src_v from public.recipe_versions where id = p_version_id;
  select * into src_r from public.recipes where id = src_v.recipe_id;
  if src_r.id is null or (src_r.owner_id <> me and not public.recipe_is_public(src_r.id)) then
    raise exception 'recipe_not_available' using errcode = '42501';
  end if;

  insert into public.recipes (owner_id, slug, name, method, method_custom, is_copy,
                              forked_from_recipe_id, forked_from_version_id, forked_from_owner_id, forked_from_version_no)
  values (me, public.make_slug(me, src_r.name), src_r.name, src_r.method, src_r.method_custom, true,
          src_r.id, src_v.id, src_r.owner_id, src_v.version_no)
  returning * into rec;

  insert into public.recipe_versions (
    recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
  select rec.id, 1, 'Copied from v' || src_v.version_no, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes
  from public.recipe_versions where id = src_v.id
  returning * into ver;

  insert into public.recipe_counters (recipe_id) values (rec.id) on conflict do nothing;
  update public.recipes set latest_version_id = ver.id, latest_version_no = 1 where id = rec.id returning * into rec;

  if src_r.owner_id <> me then
    insert into public.recipe_counters (recipe_id) values (src_r.id) on conflict do nothing;
    update public.recipe_counters set copies = copies + 1, updated_at = now() where recipe_id = src_r.id;
    insert into public.notifications (user_id, type, actor_id, recipe_id)
    values (src_r.owner_id, 'recipe_copied', me, src_r.id);
  end if;
  return rec;
end $$;
