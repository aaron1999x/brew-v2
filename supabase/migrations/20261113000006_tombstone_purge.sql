-- Daily purge of brew tombstones older than 30 days (docs/phase-4-system-design.md §9).
-- Guarded: if pg_cron can't be enabled (e.g. a database without it), the migration still applies
-- and only logs a notice. Re-run the block manually once pg_cron is available.
do $outer$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron unavailable (%); brew tombstone purge NOT scheduled', sqlerrm;
    return;
  end;

  -- cron.schedule upserts by job name, so re-running is safe.
  perform cron.schedule(
    'purge-brew-tombstones',
    '17 19 * * *',  -- 03:17 Malaysia time
    $job$delete from public.brews where deleted_at < now() - interval '30 days'$job$
  );
exception when others then
  raise notice 'could not schedule brew tombstone purge (%)', sqlerrm;
end
$outer$;
