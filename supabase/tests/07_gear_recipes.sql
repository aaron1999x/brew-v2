-- M3: gear RLS and defaults, favourite-gear sync, create_recipe / save_recipe, locking, ownership,
-- immutability, the steps shape check and the other integrity checks, account deletion with gear.
begin;
\ir 00_helpers.sql
select plan(126);

-- Method fixtures: copies of src/lib/recipes/__fixtures__/methods.json (a unit test checks they match).
\set fx_v60 '{"dose_g":15,"brew_water_g":250,"temp_c":93,"drawdown_min_s":165,"drawdown_max_s":195,"gear":{"brewer":{"name":"Hario V60 02"}},"steps":[{"id":"v60-1","kind":"pour","at_s":0,"target_g":30,"technique":"Bloom"},{"id":"v60-2","kind":"swirl","at_s":10,"duration_s":5},{"id":"v60-3","kind":"pour","at_s":45,"target_g":150},{"id":"v60-4","kind":"pour","at_s":90,"target_g":250}]}'
\set fx_switch '{"dose_g":15,"brew_water_g":240,"temp_c":95,"gear":{"brewer":{"name":"Hario Switch 02"}},"steps":[{"id":"sw-1","kind":"other","at_s":0,"label":"Close valve"},{"id":"sw-2","kind":"pour","at_s":0,"target_g":240},{"id":"sw-3","kind":"stir","at_s":25,"duration_s":5},{"id":"sw-4","kind":"wait","at_s":30,"duration_s":120},{"id":"sw-5","kind":"other","at_s":150,"label":"Open valve"}]}'
\set fx_aeropress '{"dose_g":15,"brew_water_g":220,"temp_c":90,"gear":{"brewer":{"name":"AeroPress Original"}},"steps":[{"id":"ap-1","kind":"pour","at_s":0,"target_g":220,"technique":"Inverted"},{"id":"ap-2","kind":"stir","at_s":15,"duration_s":10},{"id":"ap-3","kind":"wait","at_s":25,"duration_s":90},{"id":"ap-4","kind":"other","at_s":115,"label":"Flip onto cup"},{"id":"ap-5","kind":"press","at_s":125,"duration_s":30}]}'
\set fx_french_press '{"dose_g":30,"brew_water_g":500,"temp_c":95,"gear":{"brewer":{"name":"Bodum Chambord French Press"}},"steps":[{"id":"fp-1","kind":"pour","at_s":0,"target_g":500},{"id":"fp-2","kind":"wait","at_s":15,"duration_s":240},{"id":"fp-3","kind":"other","at_s":255,"label":"Break the crust"},{"id":"fp-4","kind":"wait","at_s":270,"duration_s":300},{"id":"fp-5","kind":"press","at_s":570,"duration_s":20}]}'
\set fx_cold_brew '{"dose_g":60,"brew_water_g":600,"temp_c":20,"bypass_g":300,"bypass_timing":"after","gear":{"brewer":{"name":"Hario Mizudashi Cold Brew Pot"}},"steps":[{"id":"cb-1","kind":"pour","at_s":0,"target_g":600},{"id":"cb-2","kind":"stir","at_s":30,"duration_s":30},{"id":"cb-3","kind":"wait","at_s":60,"duration_s":43200}]}'

select tests.create_user('gr_alice') as alice \gset
select tests.create_user('gr_bob') as bob \gset
select tests.create_user('gr_admin') as admin \gset
select tests.create_user('gr_carol') as carol \gset
update public.account_status set role = 'admin' where user_id = :'admin';

-- SQL that creates a recipe whose v1 has the given steps (used by the steps shape tests).
create function tests.bad_steps(p_steps jsonb) returns text language sql as $$
  select format($q$select public.create_recipe('Bad', 'pour_over', null, %L)$q$,
    jsonb_build_object('dose_g', 15, 'brew_water_g', 250, 'steps', p_steps));
$$;
grant execute on function tests.bad_steps(jsonb) to authenticated;

select id as cat_v60 from public.gear_catalog where brand = 'Hario' and model = 'V60 02' \gset
select id as cat_switch from public.gear_catalog where brand = 'Hario' and model = 'Switch 02' \gset
select id as cat_c40 from public.gear_catalog where brand = 'Comandante' and model = 'C40 MK4' \gset

-- =====================================================================
-- Gear catalogue: everyone reads, only admins write
-- =====================================================================
select tests.as_anon();
select ok((select count(*) from public.gear_catalog) >= 89, 'anon can read the catalogue');
select throws_ok($$insert into public.gear_catalog (category, brand, model) values ('other', 'Anon', 'Thing')$$,
  '42501', null, 'anon cannot add to the catalogue');

select tests.as_user(:'alice');
select ok((select count(*) from public.gear_catalog) >= 89, 'a member can read the catalogue');
select throws_ok($$insert into public.gear_catalog (category, brand, model) values ('other', 'Member', 'Thing')$$,
  '42501', null, 'a member cannot add to the catalogue');
update public.gear_catalog set is_active = false where id = :'cat_v60';
delete from public.gear_catalog where id = :'cat_c40';
select tests.as_owner();
select ok((select is_active from public.gear_catalog where id = :'cat_v60'),
  'a member''s update of a catalogue row changes nothing');
select is((select count(*)::int from public.gear_catalog where id = :'cat_c40'), 1,
  'a member''s delete of a catalogue row changes nothing');

select tests.as_user(:'admin');
select lives_ok($$insert into public.gear_catalog (category, brand, model) values ('other', 'Admin', 'Test item')$$,
  'an admin can add to the catalogue');
select lives_ok($$delete from public.gear_catalog where brand = 'Admin' and model = 'Test item'$$,
  'an admin can remove a catalogue row');

select tests.as_owner();
select is((select count(*)::int from public.gear_catalog where (brand, model) in (
    ('Espro', 'P7'), ('AeroPress', 'XL'), ('Hario', 'Mizudashi Cold Brew Pot'),
    ('Kalita', 'Wave 155 Paper'), ('AeroPress', 'XL Paper Filters'), ('April', 'Paper Filters'),
    ('Toddy', 'Felt Filters'), ('Melitta', '#4 Cone Paper'), ('Kingrinder', 'K4'),
    ('Timemore', 'Sculptor 078S'), ('Timemore', 'C3 ESP'), ('1Zpresso', 'Q Air'),
    ('Fellow', 'Stagg EKG Pro'), ('Fellow', 'Corvo EKG'), ('Hario', 'V60 Drip Kettle Air'),
    ('Timemore', 'Black Mirror Nano'), ('Acaia', 'Pyxis'))), 17,
  'the 17 new catalogue rows exist');
select is((select count(*)::int from public.gear_catalog where category = 'brewer' and name in (
    'Hario V60 02', 'Hario Switch 02', 'AeroPress Original', 'Bodum Chambord French Press',
    'Hario Mizudashi Cold Brew Pot')), 5,
  'the catalogue has a brewer for each method fixture');

-- =====================================================================
-- Gear items: owner only
-- =====================================================================
select tests.as_user(:'alice');
select lives_ok(format($$insert into public.gear_items (user_id, category, catalog_id) values (%L, 'brewer', %L)$$,
  :'alice', :'cat_v60'), 'Alice adds a catalogue brewer');
select id as a_v60 from public.gear_items where user_id = :'alice' and catalog_id = :'cat_v60' \gset
insert into public.gear_items (user_id, category, catalog_id) values (:'alice', 'brewer', :'cat_switch');
select id as a_switch from public.gear_items where user_id = :'alice' and catalog_id = :'cat_switch' \gset
insert into public.gear_items (user_id, category, custom_name, nickname, is_default)
  values (:'alice', 'grinder', 'My grinder', 'Old faithful', true);
select id as a_grinder from public.gear_items where user_id = :'alice' and category = 'grinder' \gset
insert into public.gear_items (user_id, category, custom_name) values (:'alice', 'kettle', 'Kettle');
select id as a_kettle from public.gear_items where user_id = :'alice' and category = 'kettle' \gset
select throws_ok(format($$insert into public.gear_items (user_id, category, custom_name) values (%L, 'other', 'Sneaky')$$,
  :'bob'), '42501', null, 'Alice cannot add a gear item for Bob');
select is((select count(*)::int from public.gear_items), 4, 'Alice sees her own 4 items');

select tests.as_user(:'bob');
select is((select count(*)::int from public.gear_items where user_id = :'alice'), 0, 'Bob cannot see Alice''s gear');
update public.gear_items set nickname = 'Mine now' where id = :'a_kettle';
delete from public.gear_items where id = :'a_kettle';
select tests.as_anon();
select is((select count(*)::int from public.gear_items), 0, 'anon cannot see any gear');
select tests.as_owner();
select ok((select nickname is null from public.gear_items where id = :'a_kettle'),
  'Bob''s update of Alice''s gear changes nothing');
select is((select count(*)::int from public.gear_items where id = :'a_kettle'), 1,
  'Bob''s delete of Alice''s gear changes nothing');

select tests.as_user(:'alice');
select lives_ok(format($$update public.gear_items set notes = 'Descale monthly' where id = %L$$, :'a_kettle'),
  'Alice can update her own gear');

-- =====================================================================
-- gear_set_default
-- =====================================================================
select lives_ok(format($$select public.gear_set_default(%L)$$, :'a_v60'), 'Alice sets the V60 as default brewer');
select ok((select is_default from public.gear_items where id = :'a_v60'), 'the V60 is the default');
select lives_ok(format($$select public.gear_set_default(%L)$$, :'a_switch'), 'Alice switches the default to the Switch');
select ok((select not is_default from public.gear_items where id = :'a_v60')
          and (select is_default from public.gear_items where id = :'a_switch'),
  'the old default is cleared and the new one set');
select is((select count(*)::int from public.gear_items where category = 'brewer' and is_default), 1,
  'exactly one default brewer');
select ok((select is_default from public.gear_items where id = :'a_grinder'),
  'the default grinder is unaffected by a brewer change');
select lives_ok(format($$select public.gear_set_default(%L)$$, :'a_switch'), 'setting the same default again is fine');
select throws_ok(format($$insert into public.gear_items (user_id, category, custom_name, is_default) values (%L, 'brewer', 'Two', true)$$,
  :'alice'), '23505', null, 'a second default in one category is rejected');
select lives_ok(format($$update public.gear_items set is_default = false where id = %L$$, :'a_switch'),
  'turning the default off is a normal update');
select is((select count(*)::int from public.gear_items where category = 'brewer' and is_default), 0,
  'no default brewer after turning it off');
select public.gear_set_default(:'a_switch');

select tests.as_user(:'bob');
select throws_ok(format($$select public.gear_set_default(%L)$$, :'a_v60'), 'P0001', 'gear_not_found',
  'Bob cannot set Alice''s item as default');
select throws_ok(format($$select public.gear_set_default(%L)$$, gen_random_uuid()), 'P0001', 'gear_not_found',
  'a missing item raises gear_not_found');
select tests.as_anon();
select throws_ok(format($$select public.gear_set_default(%L)$$, :'a_v60'), '42501', null,
  'anon cannot call gear_set_default');
select tests.as_owner();
select ok((select is_default from public.gear_items where id = :'a_switch')
          and (select not is_default from public.gear_items where id = :'a_v60'),
  'Bob''s call changed nothing');

-- =====================================================================
-- Favourite gear follows renames and deletes
-- =====================================================================
select tests.as_user(:'alice');
update public.profiles set favourite_gear = jsonb_build_array(
    jsonb_build_object('category', 'grinder', 'name', 'Legacy grinder'),
    jsonb_build_object('item_id', :'a_v60', 'category', 'brewer', 'name', 'Hario V60 02'),
    jsonb_build_object('item_id', :'a_grinder', 'category', 'grinder', 'name', 'My grinder'))
  where id = :'alice';
select tests.as_user(:'bob');
update public.profiles set favourite_gear = jsonb_build_array(
    jsonb_build_object('item_id', :'a_grinder', 'category', 'grinder', 'name', 'Bob''s copy'))
  where id = :'bob';

select tests.as_user(:'alice');
update public.gear_items set custom_name = 'Renamed grinder' where id = :'a_grinder';
select is((select favourite_gear -> 2 ->> 'name' from public.profiles where id = :'alice'), 'Renamed grinder',
  'renaming a custom item renames its favourite (order kept)');
update public.gear_items set nickname = 'New nickname' where id = :'a_grinder';
select is((select favourite_gear -> 2 ->> 'name' from public.profiles where id = :'alice'), 'Renamed grinder',
  'a nickname change never reaches the favourite');
update public.gear_items set category = 'other' where id = :'a_grinder';
select is((select favourite_gear -> 2 ->> 'category' from public.profiles where id = :'alice'), 'other',
  'a category change updates the favourite''s category');
update public.gear_items set catalog_id = :'cat_switch' where id = :'a_v60';
select is((select favourite_gear -> 1 ->> 'name' from public.profiles where id = :'alice'), 'Hario Switch 02',
  'changing the catalogue model updates the favourite''s real name');
delete from public.gear_items where id = :'a_v60';
select is((select jsonb_array_length(favourite_gear) from public.profiles where id = :'alice'), 2,
  'deleting a gear item removes its favourite');
select is((select favourite_gear -> 0 ->> 'name' from public.profiles where id = :'alice'), 'Legacy grinder',
  'legacy entries without item_id are left alone');
select is((select favourite_gear -> 1 ->> 'item_id' from public.profiles where id = :'alice'), :'a_grinder',
  'the remaining linked favourite is kept in order');
select tests.as_owner();
select is((select favourite_gear -> 0 ->> 'name' from public.profiles where id = :'bob'), 'Bob''s copy',
  'another user''s profile is never touched by the trigger');

-- =====================================================================
-- create_recipe and save_recipe as a normal member
-- =====================================================================
select tests.as_user(:'alice');
select id as r1 from public.create_recipe('V60 everyday', 'pour_over', null, :'fx_v60') \gset
select is((select slug from public.recipes where id = :'r1'), 'v60-everyday', 'create_recipe makes a slug from the name');
select is((select latest_version_no from public.recipes where id = :'r1'), 1, 'create_recipe makes v1');
select is((select jsonb_array_length(steps) from public.recipe_versions where recipe_id = :'r1'), 4,
  'the V60 fixture''s steps are stored');
select ok((select edited_at is not null from public.recipes where id = :'r1'), 'a new recipe has edited_at');
select latest_version_id as r1_v1 from public.recipes where id = :'r1' \gset

select is((select slug from public.create_recipe('V60 everyday', 'pour_over', null, :'fx_v60')), 'v60-everyday-2',
  'make_slug adds -2 for a duplicate name');
select is((select slug from public.create_recipe('V60 Everyday!', 'pour_over', null, :'fx_v60')), 'v60-everyday-3',
  'make_slug adds -3 for the next duplicate');

-- Save in place (v1 is unlocked)
select tests.as_owner();
update public.recipes set edited_at = '2020-01-01' where id = :'r1';
select tests.as_user(:'alice');
select is((public.save_recipe(:'r1', 'V60 daily', 'pour_over', null, :'r1_v1',
    (:'fx_v60')::jsonb || '{"dose_g": 16}', false)).id, :'r1_v1'::uuid,
  'save_recipe in place returns the same version');
select is((select dose_g from public.recipe_versions where id = :'r1_v1'), 16.0, 'the in-place change was saved');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'r1'), 1, 'no new version was made');
select ok((select name = 'V60 daily' and slug = 'v60-everyday' from public.recipes where id = :'r1'),
  'renaming keeps the slug');
select ok((select edited_at > '2020-01-01' from public.recipes where id = :'r1'), 'save_recipe moves edited_at');

-- Save as a new version
select (public.save_recipe(:'r1', 'V60 daily', 'pour_over', null, :'r1_v1',
    (:'fx_v60')::jsonb || '{"dose_g": 17, "change_note": "more coffee"}', true)).id as r1_v2 \gset
select ok((select version_no = 2 and dose_g = 17 and change_note = 'more coffee'
           from public.recipe_versions where id = :'r1_v2'), 'save_recipe as new version makes v2');
select ok((select latest_version_id = :'r1_v2' and latest_version_no = 2 from public.recipes where id = :'r1'),
  'the recipe points at the new latest version');
select is((select dose_g from public.recipe_versions where id = :'r1_v1'), 16.0, 'v1 is unchanged');
select is((public.save_recipe(:'r1', 'V60 daily', 'pour_over', null, :'r1_v1', :'fx_v60', true)).version_no, 3,
  'a new version can start from an older one and is numbered after the latest');

select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, false)$$,
    :'r1', gen_random_uuid(), :'fx_v60'), 'P0001', 'version_not_found',
  'a base version from nowhere raises version_not_found');
select id as r_other from public.create_recipe('Other recipe', 'pour_over', null, :'fx_v60') \gset
select latest_version_id as r_other_v1 from public.recipes where id = :'r_other' \gset
select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, false)$$,
    :'r1', :'r_other_v1', :'fx_v60'), 'P0001', 'version_not_found',
  'a base version from another recipe raises version_not_found');
select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, true)$$,
    gen_random_uuid(), :'r1_v1', :'fx_v60'), 'P0001', 'recipe_not_found',
  'a missing recipe raises recipe_not_found');
select tests.as_anon();
select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, true)$$,
    :'r1', :'r1_v1', :'fx_v60'), '42501', null, 'anon cannot call save_recipe');

-- =====================================================================
-- Locked versions (a brew references v2)
-- =====================================================================
select tests.as_user(:'alice');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'alice', :'r1_v2', now(), 8);
select isnt((select locked_at from public.recipe_versions where id = :'r1_v2'), null, 'the brew locks v2');
select throws_ok(format($$update public.recipe_versions set dose_g = 18 where id = %L$$, :'r1_v2'),
  'P0001', 'version_locked', 'a direct update of dose on a locked version is rejected');
select throws_ok(format($$update public.recipe_versions set steps = '[]' where id = %L$$, :'r1_v2'),
  'P0001', 'version_locked', 'a direct update of steps on a locked version is rejected');
select throws_ok(format($$select public.save_recipe(%L, 'V60 daily', 'pour_over', null, %L, %L, false)$$,
    :'r1', :'r1_v2', (:'fx_v60')::jsonb || '{"dose_g": 18}'), 'P0001', 'version_locked',
  'an in-place save_recipe of a brewing field on a locked version is rejected');
select is((select dose_g from public.recipe_versions where id = :'r1_v2'), 17.0, 'the locked version is unchanged');
select is((select name from public.recipes where id = :'r1'), 'V60 daily',
  'the rejected save did not half-save the name');

-- name, notes and change note save in place on a locked version
select lives_ok(format($$select public.save_recipe(%L, 'V60 locked rename', 'pour_over', null, %L, %L, false)$$,
    :'r1', :'r1_v2',
    (select to_jsonb(v) || '{"notes": "Sweeter at 92", "change_note": "tweaked note"}'
     from public.recipe_versions v where v.id = :'r1_v2')),
  'name, notes and change note save in place on a locked version');
select ok((select notes = 'Sweeter at 92' and change_note = 'tweaked note' and dose_g = 17
           from public.recipe_versions where id = :'r1_v2'), 'the notes and change note were saved');
select is((select name from public.recipes where id = :'r1'), 'V60 locked rename', 'the name was saved');
select lives_ok(format($$update public.recipe_versions set notes = 'direct notes' where id = %L$$, :'r1_v2'),
  'a direct notes update on a locked version works');
select is((public.save_recipe(:'r1', 'V60 locked rename', 'pour_over', null, :'r1_v2',
    (:'fx_v60')::jsonb || '{"dose_g": 18}', true)).version_no, 4,
  'a locked version can be the base of a new version');

-- =====================================================================
-- Other members can't read or change my recipe
-- =====================================================================
select tests.as_user(:'bob');
select is((select count(*)::int from public.recipes where id = :'r1'), 0, 'Bob cannot see Alice''s private recipe');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'r1'), 0,
  'Bob cannot see Alice''s versions');
update public.recipes set name = 'Bob was here', archived_at = now(), deleted_at = now() where id = :'r1';
update public.recipe_versions set notes = 'Bob was here' where id = :'r1_v1';
select throws_ok(format($$select public.save_recipe(%L, 'Bob', 'pour_over', null, %L, %L, false)$$,
    :'r1', :'r1_v1', :'fx_v60'), 'P0001', 'recipe_not_found', 'Bob cannot save_recipe in place on Alice''s recipe');
select throws_ok(format($$select public.save_recipe(%L, 'Bob', 'pour_over', null, %L, %L, true)$$,
    :'r1', :'r1_v1', :'fx_v60'), 'P0001', 'recipe_not_found', 'Bob cannot add a version with save_recipe');
select throws_ok(format($$select public.create_version(%L, %L)$$, :'r1', :'fx_v60'), 'P0001', 'recipe_not_found',
  'Bob cannot add a version with create_version');
select throws_ok(format($$insert into public.recipe_versions (recipe_id, version_no, dose_g, brew_water_g) values (%L, 99, 15, 250)$$,
    :'r1'), '42501', null, 'Bob cannot insert a version into Alice''s recipe');
select tests.as_owner();
select ok((select name = 'V60 locked rename' and archived_at is null and deleted_at is null
           from public.recipes where id = :'r1'), 'Bob''s rename, archive and delete changed nothing');
select ok((select notes is distinct from 'Bob was here' from public.recipe_versions where id = :'r1_v1'),
  'Bob''s version update changed nothing');

-- =====================================================================
-- Archive, soft delete, undo
-- =====================================================================
select tests.as_user(:'alice');
select lives_ok(format($$update public.recipes set archived_at = now() where id = %L$$, :'r_other'),
  'Alice can archive her recipe');
select lives_ok(format($$update public.recipes set archived_at = null, deleted_at = now() where id = %L$$, :'r_other'),
  'Alice can soft-delete her recipe');
select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, true)$$,
    :'r_other', :'r_other_v1', :'fx_v60'), 'P0001', 'recipe_not_found',
  'a soft-deleted recipe cannot get a new version through save_recipe');
select throws_ok(format($$select public.save_recipe(%L, 'X', 'pour_over', null, %L, %L, false)$$,
    :'r_other', :'r_other_v1', :'fx_v60'), 'P0001', 'recipe_not_found',
  'a soft-deleted recipe cannot be saved in place');
select throws_ok(format($$select public.create_version(%L, %L)$$, :'r_other', :'fx_v60'), '42501', null,
  'a soft-deleted recipe cannot get a new version through create_version');
update public.recipe_versions set notes = 'after delete' where id = :'r_other_v1';
select tests.as_owner();
select ok((select notes is null from public.recipe_versions where id = :'r_other_v1'),
  'a soft-deleted recipe''s versions cannot be edited directly');
select tests.as_user(:'alice');
select lives_ok(format($$update public.recipes set deleted_at = null where id = %L$$, :'r_other'),
  'undo: clearing deleted_at restores the recipe');
select lives_ok(format($$update public.recipe_versions set notes = 'after undo' where id = %L$$, :'r_other_v1'),
  'after undo its versions can be edited again');
select is((select notes from public.recipe_versions where id = :'r_other_v1'), 'after undo',
  'the edit after undo was saved');

-- =====================================================================
-- Immutable slug and owner
-- =====================================================================
select throws_ok(format($$update public.recipes set slug = 'new-slug' where id = %L$$, :'r1'),
  'P0001', 'immutable_field', 'the slug cannot be changed');
select throws_ok(format($$update public.recipes set owner_id = %L where id = %L$$, :'bob', :'r1'),
  'P0001', 'immutable_field', 'the owner cannot be changed');

-- =====================================================================
-- Steps shape: every method fixture is accepted
-- =====================================================================
select lives_ok(format($$select public.create_recipe('Switch hybrid', 'hybrid', null, %L)$$, :'fx_switch'),
  'the Switch fixture is accepted');
select lives_ok(format($$select public.create_recipe('AeroPress inverted', 'aeropress', null, %L)$$, :'fx_aeropress'),
  'the AeroPress fixture is accepted');
select lives_ok(format($$select public.create_recipe('French press', 'french_press', null, %L)$$, :'fx_french_press'),
  'the French press fixture is accepted');
select lives_ok(format($$select public.create_recipe('Cold brew', 'cold_brew', null, %L)$$, :'fx_cold_brew'),
  'the cold brew fixture (12-hour wait, bypass after) is accepted');
select is((select (steps -> 2 ->> 'duration_s')::int from public.recipe_versions v
           join public.recipes r on r.id = v.recipe_id where r.name = 'Cold brew'), 43200,
  'the 12-hour wait is stored in seconds');

-- ... and bad shapes are rejected (all through create_recipe, as a member)
select throws_like(tests.bad_steps('[{"id": "a", "kind": "bloom", "at_s": 0}]'),
  '%recipe_versions_steps_shape%', 'an unknown kind is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "wait", "at_s": -1}]'),
  '%recipe_versions_steps_shape%', 'a negative time is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "wait", "at_s": 1.5}]'),
  '%recipe_versions_steps_shape%', 'a fractional time is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "wait", "at_s": 172801}]'),
  '%recipe_versions_steps_shape%', 'a time over 48 h is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "wait"}]'),
  '%recipe_versions_steps_shape%', 'a step without a time is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0}]'),
  '%recipe_versions_steps_shape%', 'a pour without target_g is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": 0}]'),
  '%recipe_versions_steps_shape%', 'a pour target of 0 is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": 3001}]'),
  '%recipe_versions_steps_shape%', 'a pour target over 3000 g is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": "50"}]'),
  '%recipe_versions_steps_shape%', 'a pour target as text is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": 50, "temp_c": 101}]'),
  '%recipe_versions_steps_shape%', 'a pour temperature over 100 °C is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": 50, "rate_gps": 0}]'),
  '%recipe_versions_steps_shape%', 'a pour rate of 0 is rejected');
select throws_like(tests.bad_steps('[{"id": "a", "kind": "wait", "at_s": 0, "duration_s": -5}]'),
  '%recipe_versions_steps_shape%', 'a negative duration is rejected');
select throws_like(tests.bad_steps(jsonb_build_array(jsonb_build_object('id', 'a', 'kind', 'other', 'at_s', 0,
    'label', repeat('x', 61)))), '%recipe_versions_steps_shape%', 'a label over 60 characters is rejected');
select throws_like(tests.bad_steps(jsonb_build_array(jsonb_build_object('id', 'a', 'kind', 'wait', 'at_s', 0,
    'technique', repeat('x', 121)))), '%recipe_versions_steps_shape%', 'a technique over 120 characters is rejected');
select throws_like(tests.bad_steps('[{"kind": "wait", "at_s": 0}]'),
  '%recipe_versions_steps_shape%', 'a step without an id is rejected');
select throws_like(tests.bad_steps('["wait"]'),
  '%recipe_versions_steps_shape%', 'a step that is not an object is rejected');
select throws_like(tests.bad_steps((select jsonb_agg(jsonb_build_object('id', 's' || i, 'kind', 'wait', 'at_s', i))
    from generate_series(1, 31) as i)), '%recipe_versions_steps_shape%', '31 steps are rejected');
select lives_ok(tests.bad_steps((select jsonb_agg(jsonb_build_object('id', 's' || i, 'kind', 'wait', 'at_s', i))
    from generate_series(1, 30) as i)), '30 steps are accepted');
select lives_ok(tests.bad_steps('[{"id": "a", "kind": "pour", "at_s": 0, "target_g": 50, "temp_c": null, "rate_gps": null, "technique": null}]'),
  'null optional fields are accepted');
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "steps_schema": 2}'),
  '%recipe_versions_steps_schema%', 'steps_schema other than 1 is rejected');

-- =====================================================================
-- Other integrity checks
-- =====================================================================
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "bypass_g": 50}'),
  '%recipe_versions_bypass_consistent%', 'bypass without a timing is rejected');
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "bypass_g": 0, "bypass_timing": "after"}'),
  '%recipe_versions_bypass_consistent%', 'a bypass timing without bypass water is rejected');
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "drawdown_min_s": 200, "drawdown_max_s": 100}'),
  '%recipe_versions_drawdown_range%', 'drawdown min above max is rejected');
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "tds_min": 1.5, "tds_max": 1.2}'),
  '%recipe_versions_tds_range%', 'TDS min above max is rejected');
select throws_like(format($$select public.create_recipe('Bad', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "ey_min": 22, "ey_max": 18}'),
  '%recipe_versions_ey_range%', 'EY min above max is rejected');
select lives_ok(format($$select public.create_recipe('One-sided targets', 'pour_over', null, %L)$$,
    '{"dose_g": 15, "brew_water_g": 250, "drawdown_min_s": 150, "tds_max": 1.4, "ey_min": 19}'),
  'targets with only one side set are accepted');
select throws_like($$select public.create_recipe('Bad', 'other', null, '{"dose_g": 15, "brew_water_g": 250}')$$,
  '%recipes_method_custom_required%', 'method other without a name is rejected');
select throws_like($$select public.create_recipe('Bad', 'other', '   ', '{"dose_g": 15, "brew_water_g": 250}')$$,
  '%recipes_method_custom_required%', 'method other with a blank name is rejected');
select lives_ok($$select public.create_recipe('Tsubame', 'other', 'Kalita Tsubame', '{"dose_g": 15, "brew_water_g": 250}')$$,
  'method other with a name is accepted');
select throws_like(format($$select public.save_recipe(%L, 'V60', 'other', null, %L, %L, true)$$,
    :'r1', :'r1_v1', :'fx_v60'), '%recipes_method_custom_required%',
  'save_recipe also enforces the method name for other');

-- =====================================================================
-- Account deletion with gear, favourites, recipes and several versions
-- =====================================================================
select tests.as_user(:'carol');
insert into public.gear_items (user_id, category, catalog_id, is_default) values (:'carol', 'brewer', :'cat_v60', true);
select id as c_gear from public.gear_items where user_id = :'carol' \gset
insert into public.gear_items (user_id, category, custom_name, nickname) values (:'carol', 'grinder', 'Carol grinder', 'G');
update public.profiles set favourite_gear = jsonb_build_array(
    jsonb_build_object('item_id', :'c_gear', 'category', 'brewer', 'name', 'Hario V60 02'),
    jsonb_build_object('category', 'kettle', 'name', 'Legacy kettle'))
  where id = :'carol';
select id as c_rec from public.create_recipe('Carol V60', 'pour_over', null, :'fx_v60') \gset
select latest_version_id as c_v1 from public.recipes where id = :'c_rec' \gset
select public.save_recipe(:'c_rec', 'Carol V60', 'pour_over', null, :'c_v1', :'fx_v60', true);
select public.save_recipe(:'c_rec', 'Carol V60', 'pour_over', null, :'c_v1', :'fx_cold_brew', true);
select public.create_recipe('Carol cold brew', 'cold_brew', null, :'fx_cold_brew');

select tests.as_owner();
select lives_ok(format($$delete from auth.users where id = %L$$, :'carol'),
  'deleting a user with gear, favourites, recipes and several versions succeeds');
select ok((select count(*) from public.profiles where id = :'carol') = 0
          and (select count(*) from public.gear_items where user_id = :'carol') = 0
          and (select count(*) from public.recipes where owner_id = :'carol') = 0
          and (select count(*) from public.recipe_versions where recipe_id = :'c_rec') = 0,
  'cascade: profile, gear, recipes and versions are removed');

select * from finish();
rollback;
