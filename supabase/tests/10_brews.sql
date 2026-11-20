-- M4: brews are owner-only; log_brew (plain, quick change, idempotency, invalid changes, ownership);
-- locking; the snapshot guard; the flavours and date checks; my_recipe_brew_stats; account deletion.
begin;
\ir 00_helpers.sql
select plan(71);

-- A brew payload: id, version, a date, overall 7.5 (overridable through p_extra).
create function tests.brew(p_id uuid, p_version uuid, p_extra jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'recipe_version_id', p_version, 'brewed_at', now(), 'overall', 7.5) || p_extra;
$$;
grant execute on function tests.brew(uuid, uuid, jsonb) to authenticated;

\set fx_v60 '{"dose_g":15,"brew_water_g":250,"temp_c":93,"grind_setting":"18","drawdown_min_s":165,"drawdown_max_s":195,"tds_min":1.3,"tds_max":1.5,"ey_min":19,"ey_max":21,"gear":{},"steps":[{"id":"s1","kind":"pour","at_s":0,"target_g":30,"temp_c":93,"technique":"Bloom"},{"id":"s2","kind":"swirl","at_s":10,"duration_s":5},{"id":"s3","kind":"pour","at_s":45,"target_g":150,"temp_c":93},{"id":"s4","kind":"pour","at_s":90,"target_g":250,"temp_c":93}]}'
-- The same steps with the per-pour temperature at 94 (a quick change).
\set qc_steps '[{"id":"s1","kind":"pour","at_s":0,"target_g":30,"temp_c":94,"technique":"Bloom"},{"id":"s2","kind":"swirl","at_s":10,"duration_s":5},{"id":"s3","kind":"pour","at_s":45,"target_g":150,"temp_c":94},{"id":"s4","kind":"pour","at_s":90,"target_g":250,"temp_c":94}]'
\set qc_note 'Brewed with changes: grind 18 → 17, 93 → 94 °C'

select tests.create_user('bw_alice') as alice \gset
select tests.create_user('bw_bob') as bob \gset
select gen_random_uuid() as b1 \gset
select gen_random_uuid() as b2 \gset
select gen_random_uuid() as b3 \gset

select tests.as_user(:'alice');
select id as r1 from public.create_recipe('V60 brews', 'pour_over', null, :'fx_v60') \gset
select latest_version_id as v1 from public.recipes where id = :'r1' \gset

select tests.as_user(:'bob');
select id as rb from public.create_recipe('Bob recipe', 'pour_over', null, :'fx_v60') \gset
select latest_version_id as vb from public.recipes where id = :'rb' \gset

-- =====================================================================
-- Plain log: locks the version, fills snapshots and EY
-- =====================================================================
select tests.as_user(:'alice');
select is((select locked_at is null from public.recipe_versions where id = :'v1'), true, 'setup: v1 starts unlocked');

select is(
  (select version_no_snapshot::text || '/' || dose_g_snapshot::text || '/' || ey_pct::text || '/' || recipe_name_snapshot
   from public.log_brew(tests.brew(:'b1', :'v1', '{"tds_pct": 1.4, "beverage_g": 220, "flavours": ["Orange", "floral"]}'))),
  '1/15.0/20.5/V60 brews', 'log_brew logs against the version with its snapshots and EY = TDS x beverage / dose');
select tests.as_owner();
select ok((select locked_at is not null from public.recipe_versions where id = :'v1'), 'logging a brew locks its version');
select is((select user_id from public.brews where id = :'b1'), :'alice'::uuid, 'the brew belongs to the caller');

select tests.as_user(:'alice');
select throws_ok(format($$update public.recipe_versions set dose_g = 16 where id = %L$$, :'v1'),
  'P0001', 'version_locked', 'a direct update of the locked version''s brewing fields is rejected');

-- =====================================================================
-- Idempotency
-- =====================================================================
select is((select overall from public.log_brew(tests.brew(:'b1', :'v1', '{"overall": 2}'))), 7.5,
  'the same brew id returns the existing brew (nothing is overwritten)');
select is((select count(*)::int from public.brews where id = :'b1'), 1, 'and creates no second brew');

-- =====================================================================
-- Validation
-- =====================================================================
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  (tests.brew(gen_random_uuid(), :'v1') - 'overall')::text), 'P0001', 'overall_required', 'overall is required');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', '{"flavours": ["a","b","c","d","e","f","g","h","i","j","k","l","m"]}')::text),
  '23514', null, 'the flavours check rejects 13 tags');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', jsonb_build_object('flavours', jsonb_build_array(repeat('x', 31))))::text),
  '23514', null, 'the flavours check rejects a 31-character tag');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', '{"flavours": ["Orange", "orange"]}')::text),
  '23514', null, 'the flavours check rejects duplicates ignoring case');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', '{"flavours": ["  "]}')::text),
  '23514', null, 'the flavours check rejects an empty tag');
select lives_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', jsonb_build_object('flavours', jsonb_build_array(repeat('x', 30), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k')))::text),
  'a 30-character tag and 12 tags are fine');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', jsonb_build_object('brewed_at', now() + interval '1 hour'))::text),
  '23514', null, 'a brew dated an hour in the future is rejected');
select lives_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', jsonb_build_object('brewed_at', now() - interval '3 days'))::text),
  'a brew in the past is fine');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$,
  tests.brew(gen_random_uuid(), :'v1', '{"sweetness": 7.3}')::text),
  '23514', null, 'scores must be in 0.5 steps');

-- Only whitelisted columns come from the payload.
select is(
  (select user_id::text || '/' || is_others_recipe::text || '/' || source::text
   from public.log_brew(tests.brew(gen_random_uuid(), :'v1',
     jsonb_build_object('user_id', :'bob', 'is_others_recipe', true, 'recipe_name_snapshot', 'Hacked', 'ey_pct', 99)))),
  :'alice' || '/false/manual', 'user_id, snapshots and EY can''t be set through the payload');

-- =====================================================================
-- Owner-only RLS, ownership
-- =====================================================================
select tests.as_user(:'bob');
select is((select count(*)::int from public.brews where id = :'b1'), 0, 'another member sees none of my brews');
update public.brews set notes = 'hacked' where id = :'b1';
select tests.as_owner();
select is((select notes from public.brews where id = :'b1'), null, 'another member cannot update my brew');
select tests.as_user(:'bob');
select throws_ok(format($$insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
                          values (gen_random_uuid(), %L, %L, now(), 5)$$, :'alice', :'v1'),
  '42501', null, 'a member cannot insert a brew for someone else');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text),
  '42501', null, 'a member cannot log a brew against someone else''s private version');
select throws_ok(format($$select public.log_brew(%L::jsonb)$$, tests.brew(:'b1', :'vb')::text),
  'P0001', 'brew_conflict', 'a brew id that belongs to someone else is a conflict, not a read');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('grind_setting', '10', 'change_note', 'x')::text),
  'P0001', 'version_not_found', 'a quick change on someone else''s version raises version_not_found');

select tests.as_anon();
select is((select count(*)::int from public.brews), 0, 'a visitor sees no brews');
select throws_ok($$select public.log_brew('{}'::jsonb)$$, '42501', null, 'a visitor cannot call log_brew');
select throws_ok($$select * from public.my_recipe_brew_stats()$$, '42501', null, 'a visitor cannot call my_recipe_brew_stats');

-- =====================================================================
-- Snapshot guard
-- =====================================================================
select tests.as_user(:'alice');
select lives_ok(format($$update public.brews set notes = 'Sweet and clean', next_change = 'Finer' where id = %L$$, :'b1'),
  'the owner can edit results and notes');
select throws_ok(format($$update public.brews set recipe_version_id = %L where id = %L$$, :'vb', :'b1'),
  'P0001', 'brew_version_immutable', 'a brew can''t move to another version');
select throws_ok(format($$update public.brews set dose_g_snapshot = 30 where id = %L$$, :'b1'),
  'P0001', 'immutable_field', 'the dose snapshot can''t be edited (it would fake the EY)');
select throws_ok(format($$update public.brews set recipe_name_snapshot = 'Other' where id = %L$$, :'b1'),
  'P0001', 'immutable_field', 'the name snapshot can''t be edited');
select throws_ok(format($$update public.brews set version_no_snapshot = 9 where id = %L$$, :'b1'),
  'P0001', 'immutable_field', 'the version number snapshot can''t be edited');
select throws_ok(format($$update public.brews set recipe_id = %L where id = %L$$, :'rb', :'b1'),
  'P0001', 'immutable_field', 'recipe_id can''t be changed');
select throws_ok(format($$update public.brews set is_others_recipe = true where id = %L$$, :'b1'),
  'P0001', 'immutable_field', 'is_others_recipe can''t be changed');
select throws_ok(format($$update public.brews set source = 'timer' where id = %L$$, :'b1'),
  'P0001', 'immutable_field', 'source can''t be changed');
select throws_ok(format($$update public.brews set tds_pct = 25 where id = %L$$, :'b1'),
  '23514', null, 'results keep their range checks on update');

-- =====================================================================
-- Quick change: new version and brew in one call
-- =====================================================================
select is(
  (select version_no_snapshot from public.log_brew(tests.brew(:'b2', :'v1', '{"source": "timer"}'),
     jsonb_build_object('grind_setting', '17', 'temp_c', 94, 'steps', :'qc_steps'::jsonb, 'change_note', :'qc_note'))),
  2, 'a quick change logs the brew against version 2');
select tests.as_owner();
select is((select latest_version_no from public.recipes where id = :'r1'), 2, 'the recipe''s latest version is now v2');
select is((select grind_setting || '/' || temp_c::text || '/' || change_note from public.recipe_versions
           where recipe_id = :'r1' and version_no = 2),
  '17/94.0/' || :'qc_note', 'v2 has the changed values and the change note');
select is((select grind_setting || '/' || temp_c::text || '/' || dose_g::text from public.recipe_versions where id = :'v1'),
  '18/93.0/15.0', 'the base version''s content is unchanged');
select is((select steps -> 2 ->> 'temp_c' from public.recipe_versions where recipe_id = :'r1' and version_no = 2), '94',
  'v2 has the shifted per-pour temperature');
select ok((select locked_at is not null from public.recipe_versions where recipe_id = :'r1' and version_no = 2),
  'v2 is locked by the brew');
select is((select count(*)::int from public.brews where id = :'b2' and recipe_version_id =
            (select id from public.recipe_versions where recipe_id = :'r1' and version_no = 2)), 1,
  'the brew points at v2');

-- Retry with the same brew id: still one brew and one new version.
select tests.as_user(:'alice');
select is(
  (select version_no_snapshot from public.log_brew(tests.brew(:'b2', :'v1', '{"source": "timer"}'),
     jsonb_build_object('grind_setting', '17', 'temp_c', 94, 'steps', :'qc_steps'::jsonb, 'change_note', :'qc_note'))),
  2, 'a retry returns the same brew');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'r1'), 2, 'a retry creates no extra version');
select is((select count(*)::int from public.brews where id = :'b2'), 1, 'a retry creates no extra brew');

-- Invalid quick changes: nothing is created.
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('coffee_name', 'Other', 'grind_setting', '16', 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'a change to another field (coffee) is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('notes', 'new notes', 'grind_setting', '16', 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'a change to the notes is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('bypass_g', 50, 'grind_setting', '16', 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'a bypass change is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('steps', replace(:'qc_steps', '"at_s":45', '"at_s":50')::jsonb, 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'a change to step times is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('steps', '[]'::jsonb, 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'dropping the steps is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('grind_setting', '18', 'temp_c', 93, 'dose_g', 15, 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'a change that changes nothing is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('grind_setting', '16')::text),
  'P0001', 'quick_change_invalid', 'a change without a change note is rejected');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v1')::text,
  jsonb_build_object('dose_g', 5000, 'change_note', 'x')::text),
  'P0001', 'quick_change_invalid', 'an out-of-range value is rejected as an invalid change');
select tests.as_owner();
select is((select count(*)::int from public.recipe_versions where recipe_id = :'r1'), 2, 'invalid changes created no version');

-- A soft-deleted recipe: a plain log still works, a quick change doesn't.
select tests.as_user(:'alice');
select id as r2 from public.create_recipe('Deleted soon', 'pour_over', null, :'fx_v60') \gset
select latest_version_id as v_del from public.recipes where id = :'r2' \gset
update public.recipes set deleted_at = now() where id = :'r2';
select lives_ok(format($$select public.log_brew(%L::jsonb)$$, tests.brew(:'b3', :'v_del')::text),
  'a plain log on a soft-deleted recipe is allowed (the detail page reads the snapshots)');
select throws_ok(format($$select public.log_brew(%L::jsonb, %L::jsonb)$$, tests.brew(gen_random_uuid(), :'v_del')::text,
  jsonb_build_object('grind_setting', '16', 'change_note', 'x')::text),
  'P0001', 'version_not_found', 'a quick change on a soft-deleted recipe raises version_not_found');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'r2'), 1, 'and creates no version');

-- =====================================================================
-- Stats and soft delete
-- =====================================================================
select is((select sum(brew_count)::int from public.my_recipe_brew_stats() where recipe_id = :'r1'),
  (select count(*)::int from public.brews where recipe_id = :'r1' and user_id = :'alice'),
  'my_recipe_brew_stats counts the caller''s brews per recipe');
select is((select brew_count from public.my_recipe_brew_stats()
           where recipe_version_id = (select id from public.recipe_versions where recipe_id = :'r1' and version_no = 2)),
  1, 'and per version');
select tests.as_user(:'bob');
select is((select count(*)::int from public.my_recipe_brew_stats() where recipe_id = :'r1'), 0,
  'my_recipe_brew_stats shows nothing of another member''s brews');

select tests.as_user(:'alice');
update public.brews set deleted_at = now() where id = :'b2';
select is((select brew_count from public.my_recipe_brew_stats()
           where recipe_version_id = (select id from public.recipe_versions where recipe_id = :'r1' and version_no = 2)),
  null, 'a soft-deleted brew leaves the stats');
select tests.as_owner();
select ok((select locked_at is not null from public.recipe_versions where recipe_id = :'r1' and version_no = 2),
  'deleting the brew leaves its version locked');

-- =====================================================================
-- Account deletion with brews, a quick-change version and a brew by someone else
-- =====================================================================
select tests.create_user('bw_carol') as carol \gset
select tests.as_user(:'carol');
select id as rc from public.create_recipe('Carol public', 'pour_over', null, :'fx_v60') \gset
update public.recipes set visibility = 'public' where id = :'rc';
select latest_version_id as vc1 from public.recipes where id = :'rc' \gset
select (public.log_brew(tests.brew(gen_random_uuid(), :'vc1'),
  jsonb_build_object('grind_setting', '16', 'change_note', 'Brewed with changes: grind 18 → 16'))).id as c_brew \gset

select tests.as_user(:'bob');
select gen_random_uuid() as bob_brew \gset
select lives_ok(format($$select public.log_brew(%L::jsonb)$$, tests.brew(:'bob_brew', :'vc1')::text),
  'Bob can log a brew of Carol''s public recipe');
select tests.as_owner();
select is((select is_others_recipe from public.brews where id = :'bob_brew'), true, 'it is marked as someone else''s recipe');

-- Same technique as 06_accounts: defer the checks on rows created in this transaction.
set constraints all immediate;
alter table public.recipes
  alter constraint recipes_forked_from_recipe_id_fkey deferrable,
  alter constraint recipes_forked_from_owner_id_fkey deferrable;
alter table public.brews
  alter constraint brews_recipe_version_id_fkey deferrable,
  alter constraint brews_recipe_id_fkey deferrable;
set constraints all deferred;

select lives_ok(format($$delete from auth.users where id = %L$$, :'carol'),
  'deleting Carol (brews, a quick-change version, someone else''s brew of her recipe) succeeds');
select lives_ok($$set constraints all immediate$$, 'every deferred foreign key check passes after the delete');
select is((select count(*)::int from public.brews where user_id = :'carol'), 0, 'cascade: Carol''s brews are removed');
select is((select count(*)::int from public.recipe_versions where recipe_id = :'rc'), 0, 'cascade: her versions are removed');
select ok((select recipe_id is null and recipe_version_id is null and recipe_name_snapshot = 'Carol public'
                  and version_no_snapshot = 1 and dose_g_snapshot = 15
           from public.brews where id = :'bob_brew'),
  'Bob''s brew survives with its snapshots');

select tests.as_user(:'bob');
select lives_ok(format($$update public.brews set notes = 'still mine' where id = %L$$, :'bob_brew'),
  'Bob can still edit his orphaned brew');
select throws_ok(format($$update public.brews set recipe_id = %L where id = %L$$, :'rb', :'bob_brew'),
  'P0001', 'immutable_field', 'but can''t attach it to another recipe');

select * from finish();
rollback;
