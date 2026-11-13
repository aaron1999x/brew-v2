-- One-off: make an existing user an admin (docs/phase-4-system-design.md §6, "First admin").
-- The user must have signed up first. Run against the intended database only, e.g.:
--
--   psql "<connection string>" -v email=you@example.com -f supabase/scripts/make-admin.sql
--
-- Check afterwards that exactly one row was updated ("UPDATE 1").
update public.account_status set role = 'admin' where user_id = (select id from auth.users where email = :'email');
