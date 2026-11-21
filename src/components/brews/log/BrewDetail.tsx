'use client';

import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NotAvailable } from '@/components/feedback/NotAvailable';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { LazyPourCurve } from '@/components/recipes/LazyPourCurve';
import { ActionMenu } from '@/components/ui/ActionMenu/ActionMenu';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { Icon } from '@/components/ui/Icon/Icon';
import { Notice } from '@/components/ui/Notice/Notice';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { toast } from '@/components/ui/Toast/toast';
import { NO_TARGETS, extractionModel } from '@/lib/brews/extraction';
import { formFromBrewRow, tasteValues, tastedAtText } from '@/lib/brews/form';
import { brewChoicePath } from '@/lib/brews/paths';
import { useBrew, useDeleteBrew, type BrewDetailData } from '@/lib/brews/queries';
import { CHANGE_NOTE_PREFIX } from '@/lib/brews/change-note';
import { TASTE_KEYS, TASTE_LABELS } from '@/lib/brews/schema';
import { toUserMessage } from '@/lib/errors/messages';
import { newVersionPath, recipePath, versionPath } from '@/lib/recipes/paths';
import { useUnits } from '@/lib/settings/useSettings';
import { ExtractionPanel } from './ExtractionPanel';
import { LazyTasteRadar } from './LazyTasteRadar';
import styles from './BrewDetail.module.css';

const OFFLINE_DELETE = 'Deleting a brew needs a connection';

/** `/brews/[id]`: one brew, read-only, with the actions that follow from it. */
export function BrewDetail({ id }: Readonly<{ id: string }>) {
  const query = useBrew(id);
  return (
    <div className={styles.page}>
      <QueryBoundary
        label="brew"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? <Detail data={query.data} /> : <NotAvailable />}
      </QueryBoundary>
    </div>
  );
}

function Detail({ data }: Readonly<{ data: BrewDetailData }>) {
  const router = useRouter();
  const online = useOnlineStatus();
  const { dateTime } = useUnits();
  const { remove, restore } = useDeleteBrew();
  const [confirming, setConfirming] = useState(false);
  const { brew, recipe, version } = data;

  const handle = brew.author_handle_snapshot;
  // The recipe and version are still there: links and the version's own numbers. Otherwise the snapshots.
  const alive = Boolean(recipe && version && handle);
  const form = formFromBrewRow(brew);
  const note = version?.change_note?.startsWith(CHANGE_NOTE_PREFIX) ? version.change_note : null;
  const targets = version
    ? {
        tdsMin: version.tds_min,
        tdsMax: version.tds_max,
        eyMin: version.ey_min,
        eyMax: version.ey_max,
        drawdownMinS: version.drawdown_min_s,
        drawdownMaxS: version.drawdown_max_s,
      }
    : NO_TARGETS;
  const showDrawdown =
    brew.drawdown_s != null || (version ? version.drawdown_min_s != null || version.drawdown_max_s != null : false);
  const model = extractionModel({
    doseG: brew.dose_g_snapshot,
    brewWaterG: version?.brew_water_g ?? null,
    bypassG: version?.bypass_g ?? null,
    tdsPct: brew.tds_pct,
    beverageG: brew.beverage_g,
    drawdownS: brew.drawdown_s,
    targets,
    storedEy: brew.ey_pct,
  });
  const tasted = tastedAtText(brew.tasted_temp, brew.tasted_after_min);
  const scores = tasteValues(form);
  const overall = brew.overall.toFixed(1);

  function del() {
    remove.mutate(brew.id, {
      onSuccess: () => {
        setConfirming(false);
        router.replace(alive && handle && recipe ? recipePath(handle, recipe.slug) : '/home');
        // This screen has unmounted by the time Undo is pressed, so the callbacks of `mutate` would
        // never run: use the promise.
        toast.undo('Brew deleted', () => {
          restore
            .mutateAsync(brew.id)
            .then(() => {
              toast.success('Brew restored');
              router.push(`/brews/${brew.id}`);
            })
            .catch((error: unknown) => toast.error(toUserMessage(error)));
        });
      },
      onError: (error) => {
        setConfirming(false);
        toast.error(toUserMessage(error), { onRetry: del });
      },
    });
  }

  return (
    <article className={styles.article} aria-labelledby="brew-title">
      <header className={styles.header}>
        <Link
          href={alive && handle && recipe ? recipePath(handle, recipe.slug) : '/home'}
          aria-label="Back"
          className={styles.back}
          data-primary-control=""
        >
          <Icon icon={ChevronLeft} size="md" />
        </Link>
        <div className={styles.headerText}>
          <h1 id="brew-title" className={styles.title}>
            {alive && handle && recipe ? (
              <Link href={versionPath(handle, recipe.slug, brew.version_no_snapshot)} className={styles.recipeLink}>
                {brew.recipe_name_snapshot}
              </Link>
            ) : (
              brew.recipe_name_snapshot
            )}
          </h1>
          <div className={styles.badges}>
            <Badge>{`v${brew.version_no_snapshot}`}</Badge>
            {note ? <Badge tone="changed" icon={Pencil}>{note}</Badge> : null}
          </div>
          <p className={styles.muted}>Brewed {dateTime(brew.brewed_at)}</p>
        </div>
        <p className={styles.overall} aria-label={`Overall score ${overall} out of 10`}>
          <span className={styles.overallValue}>{overall}</span>
          <span className={styles.overallOf}>/ 10</span>
        </p>
      </header>

      {alive ? null : <Notice>This recipe isn’t available any more.</Notice>}

      {alive && handle && recipe ? (
        <div className={styles.actions}>
          <ButtonLink href={newVersionPath(handle, recipe.slug, brew.version_no_snapshot, brew.id)}>
            Create next version
          </ButtonLink>
          <ButtonLink href={brewChoicePath(handle, recipe.slug, brew.version_no_snapshot)} variant="secondary">
            Brew again
          </ButtonLink>
          <ActionMenu
            label="More actions for this brew"
            items={[
              {
                id: 'edit',
                label: 'Edit',
                icon: Pencil,
                onAction: () => router.push(`/brews/${brew.id}/edit`),
              },
              {
                id: 'delete',
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                onAction: () => (online ? setConfirming(true) : toast.error(OFFLINE_DELETE)),
              },
            ]}
          />
        </div>
      ) : (
        <div className={styles.actions}>
          <ButtonLink href={`/brews/${brew.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
          <Button variant="secondary" onPress={() => (online ? setConfirming(true) : toast.error(OFFLINE_DELETE))}>
            Delete
          </Button>
        </div>
      )}

      <section aria-labelledby="d-results" className={styles.section}>
        <h2 id="d-results" className={styles.sectionTitle}>
          Results
        </h2>
        <ExtractionPanel model={model} showDrawdown={showDrawdown} label="Extraction results" />
        {brew.beverage_g != null ? <BeverageLine grams={brew.beverage_g} /> : null}
      </section>

      <section aria-labelledby="d-taste" className={styles.section}>
        <h2 id="d-taste" className={styles.sectionTitle}>
          Taste
        </h2>
        <ul className={styles.scores} aria-label="Scores">
          {TASTE_KEYS.map((key, i) => (
            <li key={key} className={styles.score}>
              <span>{TASTE_LABELS[key]}</span>
              <span className="num">{scores[i] == null ? 'Not scored' : scores[i]!.toFixed(1)}</span>
            </li>
          ))}
        </ul>
        <LazyTasteRadar series={[{ key: 'brew', name: 'This brew', values: scores }]} />
      </section>

      {brew.flavours.length > 0 ? (
        <section aria-labelledby="d-flavours" className={styles.section}>
          <h2 id="d-flavours" className={styles.sectionTitle}>
            Flavours
          </h2>
          <ul className={styles.tags} aria-label="Flavours">
            {brew.flavours.map((f) => (
              <li key={f}>
                <Badge tone="accent">{f}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasted ? (
        <section aria-labelledby="d-tasted" className={styles.section}>
          <h2 id="d-tasted" className={styles.sectionTitle}>
            Tasted at
          </h2>
          <p className={styles.text}>{tasted}</p>
        </section>
      ) : null}

      {brew.notes ? (
        <section aria-labelledby="d-notes" className={styles.section}>
          <h2 id="d-notes" className={styles.sectionTitle}>
            Notes
          </h2>
          <p className={styles.text}>{brew.notes}</p>
        </section>
      ) : null}

      {brew.next_change ? (
        <section aria-labelledby="d-next" className={styles.section}>
          <h2 id="d-next" className={styles.sectionTitle}>
            Next time I’ll change…
          </h2>
          <p className={styles.text}>{brew.next_change}</p>
        </section>
      ) : null}

      {version && version.steps.length > 0 ? (
        <section aria-labelledby="d-curve" className={styles.section}>
          <h2 id="d-curve" className={styles.sectionTitle}>
            Pour curve
          </h2>
          <LazyPourCurve
            series={[{ id: version.id, label: `v${version.version_no}`, steps: version.steps }]}
            drawdown={
              version.drawdown_min_s != null || version.drawdown_max_s != null
                ? {
                    from: version.drawdown_min_s ?? version.drawdown_max_s ?? 0,
                    to: version.drawdown_max_s ?? version.drawdown_min_s ?? 0,
                  }
                : null
            }
            marker={brew.drawdown_s != null ? { atS: brew.drawdown_s, label: 'Logged drawdown' } : null}
          />
        </section>
      ) : null}

      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title="Delete this brew?"
        message="The version stays locked."
        confirmLabel="Delete"
        tone="destructive"
        isPending={remove.isPending}
        pendingLabel="Deleting…"
        onConfirm={del}
      />
    </article>
  );
}

function BeverageLine({ grams }: Readonly<{ grams: number }>) {
  const { weight } = useUnits();
  return <p className={styles.text}>Beverage weight {weight(grams)}</p>;
}
