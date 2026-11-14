-- Add an email to the sign-up allowlist (invite-only alpha). Safe to run twice.
-- Normally invites are added from /admin/invites; use this before any admin exists.
-- Run against the intended database only, e.g.:
--
--   psql "<connection string>" -v email=friend@example.com -f supabase/scripts/invite.sql
--
-- "INSERT 0 1" means the invite was added; "INSERT 0 0" means it was already there.
insert into public.signup_allowlist (email)
values (lower(btrim(:'email')))
on conflict do nothing;
