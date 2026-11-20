-- Logged-out visitors (anon) may execute only an allowlist of public-schema functions.
-- If this fails after adding a function: revoke execute from public and anon in the migration
-- (`revoke all on function … from public, anon; grant execute … to authenticated;`), or, if it is
-- meant for logged-out visitors, add it to the allowlist below and say why.
begin;
\ir 00_helpers.sql
select plan(10);

select is(
  coalesce((
    select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- extension functions
      and p.proname not in (
        -- sign-up form checks
        'can_sign_up', 'handle_status', 'handle_suggestions',
        -- public pages and anonymous events
        'verified_recipes', 'profile_stats', 'log_event',
        -- called by row-level security policies, which run as the caller
        'is_admin', 'is_moderator', 'is_suspended', 'recipe_is_public')
  ), '{}'::text[]),
  '{}'::text[],
  'anon can execute no public function outside the allowlist');

select ok(
  (select bool_and(has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'can_sign_up', 'handle_status', 'handle_suggestions', 'verified_recipes', 'profile_stats', 'log_event',
     'is_admin', 'is_moderator', 'is_suspended', 'recipe_is_public')),
  'anon keeps execute on every allowlisted function');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'can_sign_up', 'handle_status', 'handle_suggestions', 'verified_recipes', 'profile_stats', 'log_event',
     'is_admin', 'is_moderator', 'is_suspended', 'recipe_is_public')),
  10, 'every allowlisted function exists (a rename or removal must update the allowlist)');

-- Members keep what they need.
select ok(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'create_recipe', 'create_version', 'save_recipe', 'copy_recipe', 'gear_set_default',
     'make_slug', 'steps_shape_ok', 'email_is_verified', 'merge_onboarding')),
  'members can execute the member-only RPCs and their helpers');

-- Behaviour, not just catalogue: a visitor calling a member RPC is refused outright.
select tests.create_user('fg_member') as member \gset

select tests.as_anon();
select throws_ok($$select public.create_recipe('X', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}')$$,
  '42501', null, 'anon cannot call create_recipe');
select throws_ok($$select public.copy_recipe(gen_random_uuid())$$, '42501', null, 'anon cannot call copy_recipe');
select throws_ok($$select public.make_slug(gen_random_uuid(), 'x')$$, '42501', null, 'anon cannot call make_slug');
select lives_ok($$select public.can_sign_up('nobody@test.invalid')$$, 'anon can still call can_sign_up');
select lives_ok($$select count(*) from public.recipes$$, 'anon can still read recipes (policies call the helpers)');

-- Triggers still fire for a real insert even though nobody holds execute on their functions.
select tests.as_user(:'member');
select lives_ok($$select public.create_recipe('Grant check', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}')$$,
  'a member can still create a recipe (triggers and checks work without execute grants)');

select * from finish();
rollback;
