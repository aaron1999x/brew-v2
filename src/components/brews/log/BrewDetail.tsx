'use client';

import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
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
import { showsDrawdown, tasteValues, tastedAtText } from '@/lib/brews/form';
import { brewChoicePath } from '@/lib/brews/paths';
import { useBrew, useDeleteBrew, type BrewDetailData } from '@/lib/brews/queries';
import { CHANGE_NOTE_PREFIX } from '@/lib/brews/change-note';
import { ATTRIBUTE_KEYS, TASTE_LABELS } from '@/lib/brews/schema';
import { toUserMessage } from '@/lib/errors/messages';
import { newVersionPath, recipePath, versionPath } from '@/lib/recipes/paths';
import { useUnits } from '@/lib/settings/useSettings';
import { ExtractionPanel, TargetNote, targetTexts } from './ExtractionPanel';
import { LazyTasteRadar } from './LazyTasteRadar';
import cards from './BrewCards.module.css';
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
  const { dateTime, weight, duration } = useUnits();
  const { remove, restore } = useDeleteBrew();
  const [confirming, setConfirming] = useState(false);
  const { brew, recipe, version } = data;

  const handle = brew.author_handle_snapshot;
  // The recipe and version are still there: links and the version's own numbers. Otherwise the snapshots.
  const alive = Boolean(recipe && version && handle);
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
  const showDrawdown = showsDrawdown({
    method: recipe?.method,
    hasTarget: version ? version.drawdown_min_s != null || version.drawdown_max_s != null : false,
    drawdownS: brew.drawdown_s,
  });
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
  const tasted = tastedAtText(brew.tasted_temp);
  const scores = tasteValues(brew);
  const overall = brew.overall.toFixed(1);
  const targetText = targetTexts(model, duration);

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
          <div className={styles.nameRow}>
          <h1 id="brew-title" className={styles.title}>
            {alive && handle && recipe ? (
              <Link href={versionPath(handle, recipe.slug, brew.version_no_snapshot)} className={styles.recipeLink}>
                {brew.recipe_name_snapshot}
              </Link>
            ) : (
              brew.recipe_name_snapshot
            )}
          </h1>
            <Badge>{`v${brew.version_no_snapshot}`}</Badge>
          </div>
          {note ? (
            <div className={styles.badges}>
              <Badge tone="changed" icon={Pencil}>{note}</Badge>
            </div>
          ) : null}
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

      <div className={cards.cards}>
        <section aria-labelledby="d-setup" className={cards.card}>
          <h2 id="d-setup" className={cards.cardTitle}>
            Setup
          </h2>
          <dl className={styles.facts}>
            <Fact label="Recipe" value={`${brew.recipe_name_snapshot} · v${brew.version_no_snapshot}`} />
            <Fact label="Brewed at" value={dateTime(brew.brewed_at)} />
            <Fact label="Dose" value={weight(brew.dose_g_snapshot)} />
            {version ? <Fact label="Brew water" value={weight(version.brew_water_g)} /> : null}
            {version?.grind_setting ? <Fact label="Grind" value={version.grind_setting} /> : null}
            {tasted ? <Fact label="Tasted at" value={tasted.replace(/^Tasted /, '')} /> : null}
            {note ? <Fact label="Changes" value={note.replace(CHANGE_NOTE_PREFIX, '')} /> : null}
          </dl>
        </section>

        <section aria-labelledby="d-results" className={cards.card}>
          <h2 id="d-results" className={cards.cardTitle}>
            Results
          </h2>
          <dl className={styles.facts}>
            {showDrawdown && brew.drawdown_s != null ? (
              <Fact label="Drawdown" value={duration(brew.drawdown_s)}>
                <TargetNote status={model.drawdownStatus} range={targetText.drawdown} />
              </Fact>
            ) : null}
            {brew.beverage_g != null ? <Fact label="Beverage weight" value={weight(brew.beverage_g)} /> : null}
            {brew.tds_pct != null ? (
              <Fact label="TDS" value={`${brew.tds_pct}%`}>
                <TargetNote status={model.tdsStatus} range={targetText.tds} />
              </Fact>
            ) : null}
          </dl>
          <ExtractionPanel model={model} label="Extraction results" />
        </section>

        <section aria-labelledby="d-sensory" className={`${cards.card} ${cards.full}`}>
          <h2 id="d-sensory" className={cards.cardTitle}>
            Sensory
          </h2>
          <div className={styles.sensory}>
            <ul className={styles.scores} aria-label="Scores">
              {ATTRIBUTE_KEYS.map((key, i) => (
                <li key={key} className={styles.score}>
                  <span>{TASTE_LABELS[key]}</span>
                  <span className="num">{scores[i] == null ? 'Not scored' : scores[i]!.toFixed(1)}</span>
                </li>
              ))}
              <li className={`${styles.score} ${styles.scoreOverall}`}>
                <span>Overall</span>
                <span className="num">{overall}</span>
              </li>
            </ul>
            <div className={styles.radar}>
              <p className={styles.overallBig}>
                <span className={styles.overallBigValue}>{overall}</span>
                <span className={styles.overallOf}> / 10</span>
              </p>
              <LazyTasteRadar series={[{ key: 'brew', name: 'This brew', values: scores, overall: brew.overall }]} />
            </div>
          </div>
        </section>

        <>
          {brew.flavours.length > 0 ? (
            <section aria-labelledby="d-flavours" className={cards.card}>
              <h2 id="d-flavours" className={cards.cardTitle}>
                Flavour notes
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

          {brew.notes || brew.next_change ? (
            <section aria-labelledby="d-notes" className={cards.card}>
              <h2 id="d-notes" className={cards.cardTitle}>
                Notes
              </h2>
              {brew.notes ? <p className={styles.text}>{brew.notes}</p> : null}
              {brew.next_change ? (
                <div className={styles.nextChange}>
                  <h3 className={styles.subTitle}>Next time I’ll change…</h3>
                  <p className={styles.text}>{brew.next_change}</p>
                </div>
              ) : null}
            </section>
          ) : null}
        </>

        {version && version.steps.length > 0 ? (
          <section aria-labelledby="d-curve" className={`${cards.card} ${styles.wide}`}>
            <h2 id="d-curve" className={cards.cardTitle}>
              Pour curve
            </h2>
            <LazyPourCurve
              bare
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
      </div>

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

function Fact({
  label,
  value,
  children,
}: Readonly<{ label: string; value: string; children?: ReactNode }>) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>
        {value}
        {children ? <span className={styles.factNote}>{children}</span> : null}
      </dd>
    </div>
  );
}
