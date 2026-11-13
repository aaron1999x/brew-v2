-- Visitors and other users can't read or change private data. Brews are owner-only.
begin;
\ir 00_helpers.sql
select plan(26);

select tests.create_user('vis_alice') as alice \gset
select tests.create_user('vis_bob') as bob \gset

-- ---------- Alice's data ----------
select tests.as_user(:'alice');
select id as a_priv from public.create_recipe('Alice private', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as a_pub from public.create_recipe('Alice public', 'pour_over', null,
  '{"dose_g": 18, "brew_water_g": 300}') \gset
update public.recipes set visibility = 'public' where id = :'a_pub';
select latest_version_id as a_priv_v from public.recipes where id = :'a_priv' \gset
select latest_version_id as a_pub_v from public.recipes where id = :'a_pub' \gset
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'alice', :'a_priv_v', now(), 7);
insert into public.gear_items (user_id, category, custom_name)
  values (:'alice', 'grinder', 'Test grinder');
insert into public.saved_recipes (user_id, recipe_id) values (:'alice', :'a_pub');

-- ---------- Bob brews Alice's public version (Alice gets a notification) ----------
select gen_random_uuid() as b_brew \gset
select tests.as_user(:'bob');
select lives_ok(
  format('insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall) values (%L, %L, %L, now(), 6)',
         :'b_brew', :'bob', :'a_pub_v'),
  'B can log a brew against A''s public version');
select throws_ok(
  format('insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall) values (gen_random_uuid(), %L, %L, now(), 6)',
         :'bob', :'a_priv_v'),
  '42501', 'recipe_not_available',
  'B cannot log a brew against A''s private version');
select is((select count(*)::int from public.brews where id = :'b_brew'), 1, 'B sees own brew');

select tests.as_user(:'alice');
select is((select count(*)::int from public.brews where id = :'b_brew'), 0, 'A cannot see B''s brew on A''s recipe');

-- ---------- Visitor ----------
select tests.as_anon();
select is((select count(*)::int from public.recipes where id = :'a_pub'), 1, 'visitor reads a public recipe');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'a_pub'), 1, 'visitor reads its versions');
select is((select count(*)::int from public.recipes where id = :'a_priv'), 0, 'visitor cannot read a private recipe');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'a_priv'), 0, 'visitor cannot read private versions');
select is((select count(*)::int from public.brews), 0, 'visitor cannot read any brew');
select is((select count(*)::int from public.gear_items), 0, 'visitor cannot read any gear item');
select is((select count(*)::int from public.user_settings), 0, 'visitor cannot read any user_settings row');

-- ---------- Bob reads ----------
select tests.as_user(:'bob');
select is((select count(*)::int from public.recipes where id = :'a_priv'), 0, 'B cannot read A''s private recipe');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'a_priv'), 0, 'B cannot read A''s private versions');
select is((select count(*)::int from public.brews where user_id = :'alice'), 0, 'B cannot read A''s brews');
select is((select count(*)::int from public.gear_items where user_id = :'alice'), 0, 'B cannot read A''s gear');
select is((select count(*)::int from public.user_settings where user_id = :'alice'), 0, 'B cannot read A''s settings');
select is((select count(*)::int from public.saved_recipes where user_id = :'alice'), 0, 'B cannot read A''s saved recipes');
select is((select count(*)::int from public.notifications where user_id = :'alice'), 0, 'B cannot read A''s notifications');

-- ---------- Bob tries to change or delete Alice's rows (RLS makes these no-ops) ----------
update public.recipes set name = 'hacked' where id in (:'a_priv', :'a_pub');
update public.recipe_versions set notes = 'hacked' where recipe_id in (:'a_priv', :'a_pub');
update public.brews set notes = 'hacked' where user_id = :'alice';
update public.gear_items set nickname = 'hacked' where user_id = :'alice';
update public.user_settings set temp_unit = 'f' where user_id = :'alice';
update public.notifications set read_at = now() where user_id = :'alice';
delete from public.recipes where id = :'a_priv';
delete from public.brews where user_id = :'alice';
delete from public.gear_items where user_id = :'alice';
delete from public.user_settings where user_id = :'alice';
delete from public.saved_recipes where user_id = :'alice';
delete from public.notifications where user_id = :'alice';

select tests.as_owner();
select is((select count(*)::int from public.recipes where id in (:'a_priv', :'a_pub') and name like 'Alice%'), 2,
  'B could not update or delete A''s recipes');
select is((select count(*)::int from public.recipe_versions where recipe_id in (:'a_priv', :'a_pub') and notes is null), 2,
  'B could not update A''s versions');
select is((select count(*)::int from public.brews where user_id = :'alice' and notes is null), 1,
  'B could not update or delete A''s brews');
select is((select count(*)::int from public.gear_items where user_id = :'alice' and nickname is null), 1,
  'B could not update or delete A''s gear');
select is((select temp_unit from public.user_settings where user_id = :'alice'), 'c',
  'B could not update or delete A''s settings');
select is((select count(*)::int from public.saved_recipes where user_id = :'alice'), 1,
  'B could not delete A''s saved recipes');
select is((select count(*)::int from public.notifications where user_id = :'alice' and read_at is null), 1,
  'B could not update or delete A''s notifications');
select is((select count(*)::int from public.brews where id = :'b_brew'), 1, 'B''s brew is stored');

select * from finish();
rollback;
