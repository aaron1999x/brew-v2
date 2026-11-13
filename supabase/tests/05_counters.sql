-- recipe_counters: create_recipe / copy_recipe as normal members (fix migration), brewed_by_others.
begin;
\ir 00_helpers.sql
select plan(12);

select tests.create_user('cnt_alice') as alice \gset
select tests.create_user('cnt_bob') as bob \gset
select tests.create_user('cnt_carol') as carol \gset

-- ---------- create_recipe and copy_recipe work for members ----------
select tests.as_user(:'carol');
select lives_ok(
  $$select public.create_recipe('Carol immersion', 'immersion', null, '{"dose_g": 20, "brew_water_g": 320}')$$,
  'a normal member can call create_recipe');

select tests.as_user(:'alice');
select id as a_pub from public.create_recipe('Alice shared', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset
update public.recipes set visibility = 'public' where id = :'a_pub';
select latest_version_id as a_v from public.recipes where id = :'a_pub' \gset

select tests.as_user(:'bob');
select lives_ok(format('select public.copy_recipe(%L)', :'a_v'),
  'a normal member can call copy_recipe on another user''s public recipe');
select is((select count(*)::int from public.recipes where owner_id = :'bob' and is_copy and visibility = 'private'), 1,
  'the copy is private and marked as a copy');

select tests.as_owner();
select is(
  (select count(*)::int from public.recipes r
    where r.owner_id in (:'alice', :'bob', :'carol')
      and (select count(*) from public.recipe_counters c where c.recipe_id = r.id) <> 1),
  0, 'every new recipe has exactly one recipe_counters row');
select is((select count(*)::int from public.recipes where owner_id in (:'alice', :'bob', :'carol')), 3,
  'three recipes were created (create x2, copy x1)');
select is((select copies from public.recipe_counters where recipe_id = :'a_pub'), 1, 'the source recipe counts 1 copy');

-- ---------- brewed_by_others counts distinct other users ----------
select tests.as_user(:'alice');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'alice', :'a_v', now(), 7);

select tests.as_user(:'bob');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'bob', :'a_v', now(), 6);
select tests.as_owner();
select is((select brewed_by_others from public.recipe_counters where recipe_id = :'a_pub'), 1, 'first brew by B counts 1');

select tests.as_user(:'bob');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'bob', :'a_v', now(), 7);
select tests.as_owner();
select is((select brewed_by_others from public.recipe_counters where recipe_id = :'a_pub'), 1, 'second brew by B still counts 1');

select tests.as_user(:'carol');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'carol', :'a_v', now(), 8);
select tests.as_owner();
select is((select brewed_by_others from public.recipe_counters where recipe_id = :'a_pub'), 2, 'a brew by C counts 2');
select is((select owner_brews from public.recipe_counters where recipe_id = :'a_pub'), 1, 'the owner''s own brew is counted separately');

-- Counters are public with the recipe, so a visitor sees them; brews stay private.
select tests.as_anon();
select is((select brewed_by_others from public.recipe_counters where recipe_id = :'a_pub'), 2, 'visitor sees the public counters');
select is((select count(*)::int from public.brews), 0, 'visitor still sees no brews');

select * from finish();
rollback;
