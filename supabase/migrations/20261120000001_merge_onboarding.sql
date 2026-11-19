-- Onboarding progress was saved by the app as "read the whole object, change one key, write the whole
-- object back". Two saves close together (the "started" mark and a finished step, or two tabs) could
-- each write an older copy over the other's step, and a person's progress was lost. The merge now
-- happens here, in one statement, so a save can only ever add to what is stored.
--
-- Security invoker: row-level security on user_settings applies, so it only ever touches the
-- caller's own row.
create or replace function public.merge_onboarding(p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  result jsonb;
begin
  -- Only the keys the app reads, with the values it reads. Anything else would make the app treat
  -- the whole object as "nothing done yet" (its parser rejects a bad shape outright).
  if p_patch is null
     or jsonb_typeof(p_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('started_at', 'checklist_dismissed', 'steps'))
     or (p_patch ? 'started_at' and jsonb_typeof(p_patch -> 'started_at') not in ('string', 'null'))
     or (p_patch ? 'checklist_dismissed' and jsonb_typeof(p_patch -> 'checklist_dismissed') <> 'boolean')
     or (p_patch ? 'steps' and (
           jsonb_typeof(p_patch -> 'steps') <> 'object'
           or exists (select 1 from jsonb_each(p_patch -> 'steps') s
                      where s.key not in ('handle', 'units', 'gear', 'profile')
                         or s.value not in ('"done"'::jsonb, '"skipped"'::jsonb))))
  then
    raise exception 'onboarding_invalid' using errcode = 'P0001';
  end if;

  -- A step is added or replaced on its own; steps not in the patch stay as they are.
  update public.user_settings
  set onboarding = (onboarding || (p_patch - 'steps'))
        || jsonb_build_object(
             'steps', coalesce(onboarding -> 'steps', '{}'::jsonb) || coalesce(p_patch -> 'steps', '{}'::jsonb))
  where user_id = (select auth.uid())
  returning onboarding into result;

  return result;
end $$;

revoke all on function public.merge_onboarding(jsonb) from public, anon;
grant execute on function public.merge_onboarding(jsonb) to authenticated;
