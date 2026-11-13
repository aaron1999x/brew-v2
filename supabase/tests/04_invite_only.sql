-- Invite-only sign-up (app_config.invite_only + signup_allowlist + handle_new_user check).
begin;
\ir 00_helpers.sql
select plan(9);

insert into public.signup_allowlist (email) values ('inv_invited@test.invalid');

select tests.as_anon();
select is(public.can_sign_up('inv_stranger@test.invalid'), false,
  'can_sign_up is false for an email not on the allowlist while invite_only is true');
select is(public.can_sign_up('INV_Invited@test.invalid'), true,
  'can_sign_up is true for an allowlisted email (case-insensitive)');
select is((select count(*)::int from public.signup_allowlist), 0, 'visitors cannot read the allowlist');
select is((select count(*)::int from public.app_config where key = 'invite_only'), 1, 'visitors can read app_config');

select tests.as_owner();
select throws_ok(
  $$insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'inv_stranger@test.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now())$$,
  'P0001', 'invite_only', 'creating an auth user that is not on the allowlist raises invite_only');
select is((select count(*)::int from auth.users where email = 'inv_stranger@test.invalid'), 0,
  'no auth user was created for the stranger');

select lives_ok(
  $$insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'inv_invited@test.invalid', '', '{}'::jsonb, '{"handle": "inv_invited"}'::jsonb, now(), now())$$,
  'an allowlisted email can sign up');
select is((select count(*)::int from public.profiles p join auth.users u on u.id = p.id
           where u.email = 'inv_invited@test.invalid' and p.handle = 'inv_invited'), 1,
  'sign-up created the profile with the requested handle');

update public.app_config set value = 'false'::jsonb where key = 'invite_only';
select is(public.can_sign_up('inv_stranger@test.invalid'), true, 'with invite_only off anyone can sign up');

select * from finish();
rollback;
