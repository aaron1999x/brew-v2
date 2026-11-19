-- merge_onboarding: a save only ever adds to what is stored, so two saves in any order, or from two
-- tabs, keep every step.
begin;
\ir 00_helpers.sql
select plan(19);

select tests.create_user('mo_alice') as alice \gset
select tests.create_user('mo_bob') as bob \gset

select tests.as_user(:'alice');

select is(public.merge_onboarding('{"started_at": "2026-11-20T10:00:00Z"}'), '{"started_at": "2026-11-20T10:00:00Z", "steps": {}}'::jsonb,
  'the first save returns the stored object, with an empty steps object');
select is(public.merge_onboarding('{"steps": {"units": "done"}}'),
  '{"started_at": "2026-11-20T10:00:00Z", "steps": {"units": "done"}}'::jsonb,
  'a step is added and started_at is kept');
select is(public.merge_onboarding('{"steps": {"handle": "skipped"}}'),
  '{"started_at": "2026-11-20T10:00:00Z", "steps": {"units": "done", "handle": "skipped"}}'::jsonb,
  'another step is added and the first one is kept');
select is(public.merge_onboarding('{"steps": {"handle": "done"}}') -> 'steps',
  '{"units": "done", "handle": "done"}'::jsonb, 'a step can change from skipped to done');
select is(public.merge_onboarding('{"checklist_dismissed": true}'),
  '{"started_at": "2026-11-20T10:00:00Z", "checklist_dismissed": true, "steps": {"units": "done", "handle": "done"}}'::jsonb,
  'a flag is added without touching started_at or the steps');
select is(public.merge_onboarding('{}'),
  '{"started_at": "2026-11-20T10:00:00Z", "checklist_dismissed": true, "steps": {"units": "done", "handle": "done"}}'::jsonb,
  'an empty patch changes nothing');

-- The stored value is what the app reads back.
select tests.as_owner();
select is((select onboarding from public.user_settings where user_id = :'alice'),
  '{"started_at": "2026-11-20T10:00:00Z", "checklist_dismissed": true, "steps": {"units": "done", "handle": "done"}}'::jsonb,
  'the row holds the merged object');

-- The old failure: a "started" save and a finished step arriving in either order keep both.
select tests.as_user(:'bob');
select lives_ok($$select public.merge_onboarding('{"steps": {"units": "done"}}')$$, 'a finished step is saved first');
select is(public.merge_onboarding('{"started_at": "2026-11-20T11:00:00Z"}'),
  '{"started_at": "2026-11-20T11:00:00Z", "steps": {"units": "done"}}'::jsonb,
  'the started mark arriving after a finished step keeps the step');

-- Only your own row.
select tests.as_owner();
select is((select onboarding from public.user_settings where user_id = :'alice') -> 'steps',
  '{"units": "done", "handle": "done"}'::jsonb, 'Bob''s saves did not touch Alice''s settings');
select is((select count(*)::int from public.user_settings where onboarding ? 'steps' and user_id in (:'alice', :'bob')),
  2, 'both rows still have their steps');

-- Bad shapes are refused by name, and change nothing.
select tests.as_user(:'alice');
select throws_ok($$select public.merge_onboarding('{"steps": {"nope": "done"}}')$$, 'P0001', 'onboarding_invalid',
  'an unknown step is refused');
select throws_ok($$select public.merge_onboarding('{"steps": {"units": "maybe"}}')$$, 'P0001', 'onboarding_invalid',
  'an unknown step status is refused');
select throws_ok($$select public.merge_onboarding('{"steps": []}')$$, 'P0001', 'onboarding_invalid',
  'steps must be an object');
select throws_ok($$select public.merge_onboarding('{"colour": "red"}')$$, 'P0001', 'onboarding_invalid',
  'an unknown key is refused');
select throws_ok($$select public.merge_onboarding('{"checklist_dismissed": "yes"}')$$, 'P0001', 'onboarding_invalid',
  'checklist_dismissed must be a boolean');
select throws_ok($$select public.merge_onboarding('[1]')$$, 'P0001', 'onboarding_invalid', 'a patch must be an object');
select throws_ok($$select public.merge_onboarding(null)$$, 'P0001', 'onboarding_invalid', 'a null patch is refused');

select tests.as_anon();
select throws_ok($$select public.merge_onboarding('{}')$$, '42501', null, 'a visitor cannot call it');

select * from finish();
rollback;
