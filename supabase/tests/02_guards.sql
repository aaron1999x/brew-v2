-- Moderator-only fields, roles, locked versions and publish rules.
begin;
\ir 00_helpers.sql
select plan(18);

select tests.create_user('grd_alice') as alice \gset
select tests.create_user('grd_carol', false) as carol \gset
select tests.create_user('grd_dave') as dave \gset

-- ---------- Members can't change moderator-only fields or their own role ----------
select tests.as_user(:'alice');
select id as a_rec from public.create_recipe('Alice guarded', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset

select throws_ok(format('update public.profiles set is_verified = true where id = %L', :'alice'),
  '42501', 'moderator_only', 'A cannot set profiles.is_verified');
select throws_ok(format('update public.profiles set hidden_at = now() where id = %L', :'alice'),
  '42501', 'moderator_only', 'A cannot set profiles.hidden_at');
select throws_ok(format('update public.recipes set hidden_at = now() where id = %L', :'a_rec'),
  '42501', 'moderator_only', 'A cannot set recipes.hidden_at');
update public.account_status set role = 'admin' where user_id = :'alice';
select throws_ok(format('select public.admin_set_role(%L, ''admin'')', :'alice'),
  '42501', 'admin_only', 'A cannot use admin_set_role');
select is((select role::text from public.account_status where user_id = :'alice'), 'member',
  'A can read own account_status');

select tests.as_owner();
select is((select role::text from public.account_status where user_id = :'alice'), 'member',
  'A''s role is unchanged after a direct update');

-- ---------- Locked versions ----------
select tests.as_user(:'alice');
select latest_version_id as a_v from public.recipes where id = :'a_rec' \gset
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'alice', :'a_v', now(), 8);
select isnt((select locked_at from public.recipe_versions where id = :'a_v'), null,
  'logging a brew locks the version');
select throws_ok(format('update public.recipe_versions set dose_g = 16 where id = %L', :'a_v'),
  'P0001', 'version_locked', 'changing dose_g of a locked version fails with version_locked');
select lives_ok(format('update public.recipe_versions set notes = %L where id = %L', 'Better with a finer grind', :'a_v'),
  'changing notes of a locked version works');
select is((select notes from public.recipe_versions where id = :'a_v'), 'Better with a finer grind',
  'the notes change was saved');

-- ---------- Publishing needs a verified email ----------
select tests.as_user(:'carol');
select id as c_rec from public.create_recipe('Carol unverified', 'immersion', null,
  '{"dose_g": 20, "brew_water_g": 320}') \gset
select throws_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'c_rec'),
  'P0001', 'email_not_verified', 'an unconfirmed user cannot publish');

-- ---------- New accounts can publish 5 recipes per 24 h ----------
select tests.as_user(:'dave');
select id as d1 from public.create_recipe('Dave 1', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as d2 from public.create_recipe('Dave 2', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as d3 from public.create_recipe('Dave 3', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as d4 from public.create_recipe('Dave 4', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as d5 from public.create_recipe('Dave 5', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as d6 from public.create_recipe('Dave 6', 'pour_over', null, '{"dose_g": 15, "brew_water_g": 250}') \gset
select lives_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d1'), 'publish 1 of 5');
select lives_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d2'), 'publish 2 of 5');
select lives_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d3'), 'publish 3 of 5');
select lives_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d4'), 'publish 4 of 5');
select lives_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d5'), 'publish 5 of 5');
select throws_ok(format('update public.recipes set visibility = ''public'' where id = %L', :'d6'),
  'P0001', 'publish_limit', 'a new account''s 6th publish within 24 h fails with publish_limit');

select tests.as_owner();
select is((select count(*)::int from public.recipes where owner_id = :'dave' and visibility = 'public'), 5,
  'exactly 5 of Dave''s recipes are public');

select * from finish();
rollback;
