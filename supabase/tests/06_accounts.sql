-- M2 accounts: handle rules, invites, theme setting, avatar storage policies, account delete cascade.
begin;
\ir 00_helpers.sql
select plan(94);

-- Create an auth user with an explicit email and metadata (for trigger tests).
create function tests.create_user_meta(p_email text, p_meta jsonb)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := gen_random_uuid();
begin
  insert into public.signup_allowlist (email) values (p_email) on conflict do nothing;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email, '',
          now(), '{"provider": "email", "providers": ["email"]}'::jsonb, p_meta, now(), now());
  return uid;
end $$;

select tests.create_user('acc_alice') as alice \gset
select tests.create_user('acc_bob') as bob \gset
select tests.create_user('acc_carol') as carol \gset
select tests.create_user('acc_hidden') as hidden \gset
select tests.create_user('acc_mod') as mod \gset
select tests.create_user('acc_admin') as admin \gset
update public.account_status set role = 'moderator' where user_id = :'mod';
update public.account_status set role = 'admin' where user_id = :'admin';

-- A moderator hides one profile (its handle must still count as taken).
select tests.as_user(:'mod');
update public.profiles set hidden_at = now(), hidden_reason = 'test' where id = :'hidden';

-- =====================================================================
-- handle_status
-- =====================================================================
select tests.as_anon();
select is(public.handle_status('acc_free_one'), 'ok', 'handle_status: a valid free handle is ok');
select is(public.handle_status('ab'), 'invalid', 'handle_status: too short is invalid');
select is(public.handle_status(repeat('a', 31)), 'invalid', 'handle_status: too long is invalid');
select is(public.handle_status('Acc_Upper'), 'invalid', 'handle_status: uppercase is invalid');
select is(public.handle_status('acc-dash'), 'invalid', 'handle_status: a dash is invalid');
select is(public.handle_status(null), 'invalid', 'handle_status: null is invalid');
select is(public.handle_status('admin'), 'reserved', 'handle_status: a reserved handle is reserved');
select is(public.handle_status('goodbye'), 'reserved', 'handle_status: new reserved route names are reserved');
select is(public.handle_status('acc_alice'), 'taken', 'handle_status: another user''s handle is taken (visitor)');
select is(public.handle_status('acc_hidden'), 'taken', 'handle_status: a hidden profile''s handle is taken');

select tests.as_user(:'alice');
select is(public.handle_status('acc_alice'), 'ok', 'handle_status: my own current handle is ok');
select is(public.handle_status('acc_bob'), 'taken', 'handle_status: another user''s handle is taken (member)');

-- Bob changes handle: acc_bob goes to handle_history for 90 days.
select tests.as_user(:'bob');
update public.profiles set handle = 'acc_bob2' where id = :'bob';
select is(public.handle_status('acc_bob'), 'ok', 'handle_status: my own previous handle is ok for me');

select tests.as_user(:'alice');
select is(public.handle_status('acc_bob'), 'taken', 'handle_status: a handle someone else used in the last 90 days is taken');

-- =====================================================================
-- profiles_handle_guard: named errors
-- =====================================================================
select throws_ok($$update public.profiles set handle = 'AB_CD' where id = auth.uid()$$,
  'P0001', 'handle_invalid', 'changing to an uppercase handle raises handle_invalid');
select throws_ok($$update public.profiles set handle = 'x' where id = auth.uid()$$,
  'P0001', 'handle_invalid', 'changing to a too-short handle raises handle_invalid');
select throws_ok($$update public.profiles set handle = 'admin' where id = auth.uid()$$,
  'P0001', 'handle_reserved', 'changing to a reserved handle raises handle_reserved');
select throws_ok($$update public.profiles set handle = 'acc_bob2' where id = auth.uid()$$,
  'P0001', 'handle_taken', 'changing to a taken handle raises handle_taken');
select throws_ok($$update public.profiles set handle = 'acc_bob' where id = auth.uid()$$,
  'P0001', 'handle_recently_used', 'changing to a handle used by someone else in the last 90 days raises handle_recently_used');

-- =====================================================================
-- handle_new_user: same 90-day rule, long display names
-- =====================================================================
select tests.as_owner();
select tests.create_user_meta('acc_late@test.invalid',
  jsonb_build_object('handle', 'acc_bob', 'display_name', repeat('n', 70))) as late \gset
select ok((select handle::text like 'brewer\_%' and not handle_confirmed from public.profiles where id = :'late'),
  'sign-up with a handle in someone else''s 90-day window gets a temporary handle and handle_confirmed = false');
select is((select char_length(display_name) from public.profiles where id = :'late'), 60,
  'sign-up with a 70-character display name is cut to 60 instead of failing');

update public.handle_history set changed_at = now() - interval '91 days' where old_handle = 'acc_bob';
select tests.as_user(:'alice');
select is(public.handle_status('acc_bob'), 'ok', 'handle_status: a handle released more than 90 days ago is ok');

select tests.as_owner();
select tests.create_user_meta('acc_later@test.invalid', '{"handle": "acc_bob"}'::jsonb) as later \gset
select ok((select handle = 'acc_bob' and handle_confirmed from public.profiles where id = :'later'),
  'sign-up can take a handle released more than 90 days ago');

-- =====================================================================
-- handle_suggestions
-- =====================================================================
select tests.as_anon();
create temporary table sugg on commit drop as select s from public.handle_suggestions('acc_bob2') s;
grant select on sugg to anon, authenticated;
select is((select count(*)::int from sugg), 3, 'handle_suggestions returns 3 handles for a taken base');
select is((select count(*)::int from sugg where public.handle_status(s) <> 'ok'), 0,
  'every suggestion is free (handle_status ok)');
select is((select count(*)::int from sugg where s !~ '^[a-z0-9_]{3,30}$'), 0, 'every suggestion is a valid handle');
select is((select count(*)::int from sugg where s = 'acc_bob2'), 0, 'the taken base is not suggested');
select is((select count(*)::int from (select distinct s from sugg) d), 3, 'suggestions are distinct');

select is((select count(*)::int from public.handle_suggestions('Ab!') s
           where s ~ '^[a-z0-9_]{3,30}$' and public.handle_status(s) = 'ok'), 3,
  'a short, messy base is cleaned into valid free suggestions');
select is((select count(*)::int from public.handle_suggestions(repeat('z', 40)) s
           where char_length(s) <= 30 and public.handle_status(s) = 'ok'), 3,
  'a long base is trimmed so suggestions stay within 30 characters');
select is((select count(*)::int from public.handle_suggestions('admin') s where s = 'admin'), 0,
  'a reserved base is not suggested');

select tests.as_user(:'alice');
select is((select count(*)::int from public.handle_suggestions('acc_alice') s where s = 'acc_alice'), 0,
  'my own current handle is not suggested back to me');

-- =====================================================================
-- Invites: admin_list_invites / admin_add_invite / admin_remove_invite
-- =====================================================================
select tests.as_anon();
select throws_ok($$select * from public.admin_list_invites()$$, '42501', null,
  'visitors cannot call admin_list_invites');
select throws_ok($$select public.admin_add_invite('x@test.invalid')$$, '42501', null,
  'visitors cannot call admin_add_invite');

select tests.as_user(:'alice');
select throws_ok($$select * from public.admin_list_invites()$$, '42501', 'admin_only',
  'members cannot list invites');
select throws_ok($$select public.admin_add_invite('acc_new@test.invalid')$$, '42501', 'admin_only',
  'members cannot add invites');
select throws_ok($$select public.admin_remove_invite('acc_alice@test.invalid')$$, '42501', 'admin_only',
  'members cannot remove invites');

select tests.as_user(:'mod');
select throws_ok($$select * from public.admin_list_invites()$$, '42501', 'admin_only',
  'moderators cannot list invites');
select throws_ok($$select public.admin_add_invite('acc_new@test.invalid')$$, '42501', 'admin_only',
  'moderators cannot add invites');

select tests.as_user(:'admin');
select lives_ok($$select public.admin_add_invite('  ACC_New@Test.invalid ')$$, 'admins can add an invite');
select is((select count(*)::int from public.signup_allowlist
           where email = 'acc_new@test.invalid' and email::text = 'acc_new@test.invalid' and invited_by = auth.uid()), 1,
  'the invite is stored trimmed, lowercased and credited to the admin');
select lives_ok($$select public.admin_add_invite('acc_new@test.invalid')$$, 'adding the same invite twice is fine');
select throws_ok($$select public.admin_add_invite('not-an-email')$$, 'P0001', 'email_invalid',
  'an invalid email raises email_invalid');
select throws_ok($$select public.admin_add_invite('a@b')$$, 'P0001', 'email_invalid',
  'an email without a domain dot raises email_invalid');

select is((select count(*)::int from public.admin_list_invites()
           where email = 'acc_new@test.invalid' and signed_up_at is null and invited_by_handle = 'acc_admin'), 1,
  'admin_list_invites shows an unused invite with who invited and no sign-up date');
select is((select count(*)::int from public.admin_list_invites()
           where email = 'acc_alice@test.invalid' and signed_up_at is not null), 1,
  'admin_list_invites shows a used invite with its sign-up date');

select throws_ok($$select public.admin_remove_invite('ACC_Alice@test.invalid')$$, 'P0001', 'invite_used',
  'an invite that was used cannot be removed');
select lives_ok($$select public.admin_remove_invite('acc_new@test.invalid')$$, 'an unused invite can be removed');
select is((select count(*)::int from public.signup_allowlist where email = 'acc_new@test.invalid'), 0,
  'the removed invite is gone');

-- Direct table access
select tests.as_user(:'alice');
select is((select count(*)::int from public.signup_allowlist), 0, 'members cannot read signup_allowlist');
select throws_ok($$insert into public.signup_allowlist (email) values ('acc_sneak@test.invalid')$$, '42501', null,
  'members cannot insert into signup_allowlist');
delete from public.signup_allowlist where email = 'acc_bob@test.invalid';
update public.signup_allowlist set email = 'acc_x@test.invalid' where email = 'acc_carol@test.invalid';

select tests.as_user(:'admin');
select is((select count(*)::int from public.signup_allowlist
           where email in ('acc_bob@test.invalid', 'acc_carol@test.invalid')), 2,
  'members could not delete or change allowlist rows (admins still see both)');
select lives_ok($$insert into public.signup_allowlist (email) values ('acc_direct@test.invalid')$$,
  'admins can insert into signup_allowlist directly');
select lives_ok($$delete from public.signup_allowlist where email = 'acc_direct@test.invalid'$$,
  'admins can delete from signup_allowlist directly');

-- =====================================================================
-- user_settings.theme (owner only, checked values)
-- =====================================================================
select tests.as_user(:'alice');
select is((select theme from public.user_settings where user_id = auth.uid()), 'system', 'theme defaults to system');
select lives_ok($$update public.user_settings set theme = 'dark' where user_id = auth.uid()$$,
  'a user can change their own theme');
select is((select theme from public.user_settings where user_id = auth.uid()), 'dark', 'the theme was saved');
select throws_ok($$update public.user_settings set theme = 'neon' where user_id = auth.uid()$$, '23514', null,
  'an unknown theme is rejected');
select throws_ok($$update public.user_settings set onboarding = '[]' where user_id = auth.uid()$$, '23514', null,
  'onboarding must be a JSON object');

select tests.as_user(:'bob');
select is((select count(*)::int from public.user_settings where user_id = :'alice'), 0,
  'another user cannot read my settings');
update public.user_settings set theme = 'light' where user_id = :'alice';
select tests.as_owner();
select is((select theme from public.user_settings where user_id = :'alice'), 'dark',
  'another user cannot change my theme');

-- =====================================================================
-- Avatar storage policies (owner folder only)
-- =====================================================================
-- Supabase blocks direct DELETE on storage tables unless this is set; only for this transaction.
select set_config('storage.allow_delete_query', 'true', true);

select tests.as_user(:'bob');
insert into storage.objects (bucket_id, name) values ('avatars', :'bob' || '/avatar.webp');

select tests.as_user(:'alice');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('avatars', %L)$$, :'alice' || '/avatar.webp'),
  'a user can upload into their own avatars folder');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('avatars', %L)$$, :'bob' || '/evil.webp'),
  '42501', null, 'a user cannot upload into another user''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'avatar.webp')$$,
  '42501', null, 'a user cannot upload outside a user folder');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'alice' || '/avatar.webp'), 1,
  'a user can see their own file (needed by the Storage API for upsert and remove)');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name like :'bob' || '/%'), 0,
  'a user cannot see another user''s files through the table');
select lives_ok(format($$update storage.objects set name = %L where bucket_id = 'avatars' and name = %L$$,
                       :'alice' || '/avatar.jpg', :'alice' || '/avatar.webp'),
  'a user can update their own file');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'alice' || '/avatar.jpg'), 1,
  'the update changed the file row');
select throws_ok(format($$update storage.objects set name = %L where bucket_id = 'avatars' and name = %L$$,
                        :'bob' || '/moved.jpg', :'alice' || '/avatar.jpg'),
  '42501', null, 'a user cannot move their file into another user''s folder');
update storage.objects set metadata = '{"x": 1}'::jsonb where bucket_id = 'avatars' and name = :'bob' || '/avatar.webp';
delete from storage.objects where bucket_id = 'avatars' and name = :'bob' || '/avatar.webp';
select tests.as_owner();
select is((select count(*)::int from storage.objects
           where bucket_id = 'avatars' and name = :'bob' || '/avatar.webp' and metadata is distinct from '{"x": 1}'::jsonb), 1,
  'a user cannot update or delete another user''s file');

select tests.as_user(:'alice');
delete from storage.objects where bucket_id = 'avatars' and name = :'alice' || '/avatar.jpg';
select tests.as_owner();
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name like :'alice' || '/%'), 0,
  'a user can delete their own file');

select tests.as_anon();
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('avatars', %L)$$, :'alice' || '/anon.webp'),
  '42501', null, 'visitors cannot upload avatars');
select tests.as_owner();
delete from storage.objects where bucket_id = 'avatars' and name like :'bob' || '/%';

-- =====================================================================
-- Account delete cascade
-- =====================================================================
-- Carol: recipes (private + public with 2 versions), brew, gear, saved, handle history, notifications.
select tests.as_user(:'carol');
select id as c_priv from public.create_recipe('Carol private', 'pour_over', null,
  '{"dose_g": 15, "brew_water_g": 250}') \gset
select id as c_pub from public.create_recipe('Carol public', 'pour_over', null,
  '{"dose_g": 18, "brew_water_g": 300}') \gset
update public.recipes set visibility = 'public' where id = :'c_pub';
select latest_version_id as c_v1 from public.recipes where id = :'c_pub' \gset
select (public.create_version(:'c_pub', '{"dose_g": 19, "brew_water_g": 300}')).id as c_v2 \gset
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (gen_random_uuid(), :'carol', :'c_v1', now(), 7);
insert into public.gear_items (user_id, category, custom_name) values (:'carol', 'grinder', 'Carol grinder');
insert into public.saved_recipes (user_id, recipe_id) values (:'carol', :'c_pub');
update public.profiles set handle = 'acc_carol2' where id = :'carol';

-- Bob brews Carol's public v1 and copies it (Carol gets notifications).
select gen_random_uuid() as b_brew \gset
select tests.as_user(:'bob');
insert into public.brews (id, user_id, recipe_version_id, brewed_at, overall)
  values (:'b_brew', :'bob', :'c_v1', now(), 6);
select (public.copy_recipe(:'c_v1')).id as b_copy \gset
select latest_version_id as b_copy_v from public.recipes where id = :'b_copy' \gset

-- While Carol's version exists, the guards still reject direct changes.
select throws_ok(format($$update public.brews set recipe_version_id = null where id = %L$$, :'b_brew'),
  'P0001', 'brew_version_immutable', 'a brew''s version cannot be set to null while the version exists');
select throws_ok(format($$update public.brews set recipe_version_id = %L where id = %L$$, :'b_copy_v', :'b_brew'),
  'P0001', 'brew_version_immutable', 'a brew cannot be moved to another version');
select throws_ok(format($$update public.recipes set forked_from_version_id = null where id = %L$$, :'b_copy'),
  'P0001', 'immutable_field', 'a copy''s forked_from_version_id cannot be cleared while the version exists');
select throws_ok(format($$update public.recipes set forked_from_version_id = %L where id = %L$$, :'c_v2', :'b_copy'),
  'P0001', 'immutable_field', 'a copy''s forked_from_version_id cannot point at another version');

select tests.as_owner();
select is((select count(*)::int from public.notifications where user_id = :'carol'), 2,
  'setup: Carol has notifications (brewed + copied)');

-- The setup rows were inserted in this same transaction, so Postgres would re-check their foreign
-- keys on every cascade update (it does not for rows from earlier transactions, as in a real
-- account deletion). Defer those checks during the delete, then force them all with
-- SET CONSTRAINTS ALL IMMEDIATE so every foreign key is still verified. Rolled back with the test.
-- (recipes_forked_from_version_fk is already deferred by migration 20261114000002; that fix is
-- what the real committed delete in scripts/verify-account-delete.mjs depends on.)
-- Run its pending checks for the setup rows first: ALTER TABLE refuses while checks are pending.
set constraints all immediate;
alter table public.recipes
  alter constraint recipes_forked_from_recipe_id_fkey deferrable,
  alter constraint recipes_forked_from_owner_id_fkey deferrable;
alter table public.brews
  alter constraint brews_recipe_version_id_fkey deferrable,
  alter constraint brews_recipe_id_fkey deferrable;
set constraints all deferred;

select lives_ok(format($$delete from auth.users where id = %L$$, :'carol'),
  'deleting Carol''s auth user succeeds with another user''s brew and copy in place');
select lives_ok($$set constraints all immediate$$, 'every deferred foreign key check passes after the delete');

select is((select count(*)::int from public.profiles where id = :'carol'), 0, 'cascade: profile removed');
select is((select count(*)::int from public.user_settings where user_id = :'carol'), 0, 'cascade: settings removed');
select is((select count(*)::int from public.account_status where user_id = :'carol'), 0, 'cascade: account status removed');
select is((select count(*)::int from public.gear_items where user_id = :'carol'), 0, 'cascade: gear removed');
select is((select count(*)::int from public.recipes where owner_id = :'carol' or id in (:'c_priv', :'c_pub')), 0,
  'cascade: recipes removed');
select is((select count(*)::int from public.recipe_versions where recipe_id in (:'c_priv', :'c_pub')), 0,
  'cascade: recipe versions removed');
select is((select count(*)::int from public.brews where user_id = :'carol'), 0, 'cascade: brews removed');
select is((select count(*)::int from public.saved_recipes where user_id = :'carol'), 0, 'cascade: saved rows removed');
select is((select count(*)::int from public.notifications where user_id = :'carol'), 0, 'cascade: notifications removed');
select is((select count(*)::int from public.handle_history where user_id = :'carol'), 0, 'cascade: handle history removed');

select ok((select is_copy and forked_from_owner_id is null and forked_from_version_id is null
                  and forked_from_recipe_id is null and forked_from_version_no = 1
           from public.recipes where id = :'b_copy'),
  'Bob''s copy survives with the credit cleared to "deleted user"');
select is((select count(*)::int from public.recipe_versions where id = :'b_copy_v'), 1, 'Bob''s copy keeps its own version');
select ok((select recipe_version_id is null and recipe_id is null
                  and recipe_name_snapshot = 'Carol public' and author_handle_snapshot = 'acc_carol2'
                  and version_no_snapshot = 1 and dose_g_snapshot = 18
           from public.brews where id = :'b_brew'),
  'Bob''s brew survives with its snapshots');

select tests.as_user(:'bob');
select throws_ok(format($$update public.brews set recipe_version_id = %L where id = %L$$, :'b_copy_v', :'b_brew'),
  'P0001', 'brew_version_immutable', 'after the delete, the brew still cannot be attached to another version');

-- The deferred foreign key still rejects a version that doesn't exist (checked at commit;
-- forced here with SET CONSTRAINTS ... IMMEDIATE).
select tests.as_owner();
select throws_ok(
  format($$insert into public.recipes (owner_id, slug, name, method, is_copy, forked_from_version_id)
           values (%L, 'acc-bad-fork', 'Bad fork', 'pour_over', true, gen_random_uuid());
           set constraints recipes_forked_from_version_fk immediate$$, :'bob'),
  '23503', null, 'recipes_forked_from_version_fk still rejects a missing version once checked');

select * from finish();
rollback;
