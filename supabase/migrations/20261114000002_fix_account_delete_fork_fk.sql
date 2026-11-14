-- Account deletion, second fix (found by scripts/verify-account-delete.mjs on staging).
--
-- Deleting a user whose public recipe another user had copied failed with
--   insert or update on table "recipes" violates foreign key constraint "recipes_forked_from_version_fk"
-- When the author is deleted, Postgres cascades the delete to their recipes and versions and runs
-- several ON DELETE SET NULL updates on the copy (forked_from_recipe_id, forked_from_owner_id,
-- forked_from_version_id). An update that runs before the version's own SET NULL re-checks the
-- copy's forked_from_version_id against a version that is already gone, so the delete aborts.
--
-- Fix: check this foreign key at the end of the statement/transaction instead of immediately.
-- By then the SET NULL has run and the reference is null. Normal inserts and updates are still
-- checked (just at commit), so a bad forked_from_version_id is still rejected.
alter table public.recipes
  alter constraint recipes_forked_from_version_fk deferrable initially deferred;
