-- Shared test helpers. Included by every test file right after `begin;` via `\ir 00_helpers.sql`,
-- so everything here (schema, functions, users) is rolled back with the test transaction.
-- scripts/db-test.mjs skips this file when running the suite.
--
-- Test users always use the @test.invalid domain; db-test.mjs checks none remain afterwards.

set local search_path = public, extensions;

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Create an auth user (and, via the trigger, profile + status + settings). Allowlists the email
-- first so the invite-only check passes. Run as the owner role only.
create function tests.create_user(p_handle text, p_confirmed boolean default true)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  uid   uuid := gen_random_uuid();
  addr  text := p_handle || '@test.invalid';
begin
  insert into public.signup_allowlist (email) values (addr) on conflict do nothing;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', addr, '',
    case when p_confirmed then now() end,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('handle', p_handle, 'display_name', p_handle),
    now(), now());
  return uid;
end $$;
revoke all on function tests.create_user(text, boolean) from public, anon, authenticated;

-- Act as a signed-in user (same as: set local role authenticated; set local request.jwt.claims = ...).
create function tests.as_user(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

-- Act as a logged-out visitor.
create function tests.as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;

-- Return to the owner (session) role between steps.
create function tests.as_owner()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;

grant execute on function tests.as_user(uuid), tests.as_anon(), tests.as_owner() to anon, authenticated;

-- Make sure invite-only is on for the duration of the test, whatever staging's current setting is.
update public.app_config set value = 'true'::jsonb where key = 'invite_only';
