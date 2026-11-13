-- Moderator hide, and suspended accounts.
begin;
\ir 00_helpers.sql
select plan(12);

select tests.create_user('mod_alice') as alice \gset
select tests.create_user('mod_bob') as bob \gset
select tests.create_user('mod_eve') as eve \gset
select tests.create_user('mod_mo') as mo \gset
update public.account_status set role = 'moderator' where user_id = :'mo';

select tests.as_user(:'alice');
select id as a_pub from public.create_recipe('Alice to hide', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset
update public.recipes set visibility = 'public' where id = :'a_pub';

select tests.as_user(:'eve');
select id as e_pub from public.create_recipe('Eve public', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset
update public.recipes set visibility = 'public' where id = :'e_pub';
select latest_version_id as e_v from public.recipes where id = :'e_pub' \gset

-- ---------- Hiding ----------
select tests.as_user(:'bob');
select throws_ok(format('select public.mod_set_recipe_hidden(%L, true, %L)', :'a_pub', 'spam'),
  '42501', 'moderator_only', 'a member cannot hide recipes');
select is((select count(*)::int from public.recipes where id = :'a_pub'), 1, 'B reads the public recipe before hiding');

select tests.as_user(:'mo');
select lives_ok(format('select public.mod_set_recipe_hidden(%L, true, %L)', :'a_pub', 'spam'),
  'a moderator can hide a recipe');

select tests.as_anon();
select is((select count(*)::int from public.recipes where id = :'a_pub'), 0, 'visitor cannot read the hidden recipe');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'a_pub'), 0, 'visitor cannot read its versions');

select tests.as_user(:'bob');
select is((select count(*)::int from public.recipes where id = :'a_pub'), 0, 'B cannot read the hidden recipe');

-- ---------- Suspension ----------
select tests.as_user(:'mo');
select lives_ok(format('select public.mod_set_suspended(%L, true, %L)', :'eve', 'test'),
  'a moderator can suspend a user');

select tests.as_anon();
select is((select count(*)::int from public.recipes where id = :'e_pub'), 0, 'visitor cannot read a suspended user''s public recipe');
select is((select count(*)::int from public.profiles where id = :'eve'), 0, 'visitor cannot read a suspended user''s profile');

select tests.as_user(:'bob');
select is((select count(*)::int from public.recipes where id = :'e_pub'), 0, 'B cannot read a suspended user''s public recipe');

select tests.as_user(:'eve');
select throws_ok(
  format('insert into public.recipes (owner_id, slug, name, method) values (%L, %L, %L, %L)', :'eve', 'after-suspension', 'After', 'pour_over'),
  '42501', null, 'a suspended user cannot insert recipes');
select throws_ok(
  format('insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall) values (gen_random_uuid(), %L, %L, now(), 5)', :'eve', :'e_v'),
  '42501', null, 'a suspended user cannot insert brews');

select * from finish();
rollback;
