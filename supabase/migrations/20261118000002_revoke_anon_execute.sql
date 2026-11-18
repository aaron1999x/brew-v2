-- Logged-out visitors (anon) could execute every function in the public schema: Supabase's default
-- privileges grant execute to anon, and older functions also kept Postgres's default PUBLIC execute.
-- Member-only RPCs were therefore callable without logging in (they failed later on auth.uid() or
-- RLS, but they shouldn't be reachable at all). supabase/tests/08_function_grants.sql now fails if
-- anon gains execute on anything outside its allowlist.
--
-- Kept for anon on purpose:
--   can_sign_up, handle_status, handle_suggestions   sign-up form checks (before there is a session)
--   verified_recipes, profile_stats                   public pages
--   log_event                                         anonymous product events
--   is_admin, is_moderator, is_suspended, recipe_is_public
--                                                     called by row-level security policies, which
--                                                     run as the caller, so anon's reads need them

-- Member-only functions: logged-in users only.
revoke all on function
  public.copy_recipe(uuid),
  public.create_recipe(text, public.brew_method, text, jsonb),
  public.create_version(uuid, jsonb),
  public.email_is_verified(uuid),
  public.make_slug(uuid, text),
  public.steps_shape_ok(jsonb)
from public, anon;

-- create_recipe is security invoker, so it runs make_slug and the steps check as the member.
grant execute on function
  public.copy_recipe(uuid),
  public.create_recipe(text, public.brew_method, text, jsonb),
  public.create_version(uuid, jsonb),
  public.email_is_verified(uuid),
  public.make_slug(uuid, text),
  public.steps_shape_ok(jsonb)
to authenticated;

-- Trigger functions: Postgres checks execute only when a trigger is created, not when it fires,
-- and they can't be called directly, so nobody needs to hold the privilege.
revoke all on function
  public.brews_after_insert(),
  public.brews_before_write(),
  public.gear_items_sync_favourites(),
  public.handle_new_user(),
  public.profiles_handle_guard(),
  public.profiles_moderation_guard(),
  public.recipe_versions_lock_guard(),
  public.recipes_after_insert(),
  public.recipes_guard(),
  public.saved_recipes_count(),
  public.set_updated_at()
from public, anon;
