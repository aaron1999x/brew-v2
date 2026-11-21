'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuickChangePanel } from '@/components/brews/QuickChangePanel';
import { ButtonLink } from '@/components/ui/ButtonLink/ButtonLink';
import { Button } from '@/components/ui/Button/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Notice } from '@/components/ui/Notice/Notice';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { LoadingRegion, SkeletonCard } from '@/components/ui/Skeleton/Skeleton';
import { Sheet, SheetActions } from '@/components/ui/Sheet/Sheet';
import { toast } from '@/components/ui/Toast/toast';
import { describeChanges } from '@/lib/brews/change-note';
import { draftFromForm, formFromDraft } from '@/lib/brews/form';
import { useLogBrew } from '@/lib/brews/queries';
import { applyQuickChange } from '@/lib/brews/quick-change';
import { toLogBrewPayload, type BrewLogForm, type QuickChange } from '@/lib/brews/schema';
import { nextVersionNo, withForm } from '@/lib/brews/sessions';
import { useBrewSession } from '@/lib/brews/useBrewSessions';
import { toUserMessage } from '@/lib/errors/messages';
import { useUnits } from '@/lib/settings/useSettings';
import { BrewLogFormView } from './BrewLogForm';
import styles from './BrewScreens.module.css';

export const OFFLINE_SAVE_MESSAGE =
  'Saving brews needs a connection for now. Your log is kept on this phone.';

/** How long to wait after the last change before keeping the draft on the device. */
const DRAFT_DELAY_MS = 400;

/**
 * `/brews/new?session=<id>`: the log for a brew session on this device. The form is kept in the
 * session as it is filled in, so leaving, a reload or coming back from Home restores it. Saving
 * goes through `log_brew` (with the quick change as a new version) and then removes the session.
 */
export function NewBrewScreen({ sessionId }: Readonly<{ sessionId: string | null }>) {
  const router = useRouter();
  const { session, ready, update, remove } = useBrewSession(sessionId);
  const { units } = useUnits();
  const online = useOnlineStatus();
  const logBrew = useLogBrew();
  const leaving = useRef(false);
  const [askKeep, setAskKeep] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  // The form starts from what the session holds, and does not follow its own saved copy.
  const initial = useMemo<BrewLogForm | null>(() => {
    if (!session) return null;
    const timer = session.timer;
    return formFromDraft(session.form, {
      brewedAt: new Date(timer?.startedAt ?? Date.now()).toISOString(),
      drawdownS: timer?.drawdownS ?? null,
    });
    // Only when a different session opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Keep the draft on the device, debounced; flush it when the page is hidden or closed.
  const draftTimer = useRef<number | undefined>(undefined);
  const latest = useRef<BrewLogForm | null>(null);
  const flush = useCallback(() => {
    window.clearTimeout(draftTimer.current);
    const form = latest.current;
    latest.current = null;
    if (form && !leaving.current) update((s) => withForm(s, draftFromForm(form)));
  }, [update]);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      window.clearTimeout(draftTimer.current);
    };
  }, [flush]);
  const keepDraft = useCallback(
    (form: BrewLogForm) => {
      latest.current = form;
      window.clearTimeout(draftTimer.current);
      draftTimer.current = window.setTimeout(flush, DRAFT_DELAY_MS);
    },
    [flush],
  );

  if (!ready) {
    return (
      <div className={styles.page}>
        <LoadingRegion label="brew log">
          <SkeletonCard />
        </LoadingRegion>
      </div>
    );
  }
  if (!session || !initial) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="This brew isn't on this phone"
          text="It may have been saved or discarded already."
          action={<ButtonLink href="/home">Back to Home</ButtonLink>}
        />
      </div>
    );
  }

  const base = session.version;
  const applied = applyQuickChange(base, session.quickChange);
  const changes = describeChanges(base, session.quickChange, units);
  const showDrawdown =
    session.method === 'pour_over' ||
    session.method === 'hybrid' ||
    base.drawdown_min_s != null ||
    base.drawdown_max_s != null;

  function setChange(change: QuickChange | null) {
    update((s) => ({ ...s, quickChange: change }));
  }

  function save(form: BrewLogForm) {
    if (!session) return;
    if (!online) {
      toast.error(OFFLINE_SAVE_MESSAGE);
      return;
    }
    const payload = toLogBrewPayload({
      sessionId: session.id,
      versionId: session.versionId,
      base,
      quickChange: session.quickChange,
      form,
      timerUsed: session.timer?.startedAt != null,
      units,
    });
    logBrew.mutate(payload, {
      onSuccess: (brew) => {
        leaving.current = true;
        window.clearTimeout(draftTimer.current);
        toast.success(
          payload.newVersion ? `Brew saved as v${brew.version_no_snapshot}` : 'Brew saved',
        );
        router.replace(`/brews/${brew.id}`);
        remove();
      },
      onError: (error) => {
        toast.error(
          !navigator.onLine ? OFFLINE_SAVE_MESSAGE : toUserMessage(error),
          { onRetry: () => save(form) },
        );
      },
    });
  }

  function leave(path: string, discard: boolean) {
    if (!discard) flush();
    leaving.current = true;
    window.clearTimeout(draftTimer.current);
    router.replace(path);
    if (discard) remove();
  }

  const changed = changes.length > 0;
  return (
    <>
      <BrewLogFormView
        key={session.id}
        title="Log brew"
        header={{
          recipeName: session.recipeName,
          versionLabel: `v${session.versionNo}`,
          changes,
          note: changed ? `Saves as v${nextVersionNo(session)} when you log this brew.` : null,
        }}
        initial={initial}
        context={{
          doseG: applied.dose_g,
          brewWaterG: applied.brew_water_g,
          bypassG: base.bypass_g,
          targets: {
            tdsMin: base.tds_min,
            tdsMax: base.tds_max,
            eyMin: base.ey_min,
            eyMax: base.ey_max,
            drawdownMinS: base.drawdown_min_s,
            drawdownMaxS: base.drawdown_max_s,
          },
          showDrawdown,
        }}
        isSaving={logBrew.isPending}
        saveLabel="Save"
        notices={
          <>
            {!online ? <Notice>{OFFLINE_SAVE_MESSAGE}</Notice> : null}
            {session.entry === 'log' ? (
              <QuickChangePanel
                base={base}
                change={session.quickChange}
                onChange={setChange}
                nextVersionNo={nextVersionNo(session)}
              />
            ) : null}
          </>
        }
        onChange={keepDraft}
        onSave={save}
        onCancel={() => setAskKeep(true)}
      />

      <Sheet isOpen={askKeep} onOpenChange={setAskKeep} title="Keep this brew for later?" hideCloseButton>
        {(close) => (
          <>
            <p className={styles.message}>
              Keep it and it waits on Home, with everything you have filled in.
            </p>
            <SheetActions>
              <Button variant="secondary" onPress={close}>
                Back to log
              </Button>
              <Button
                variant="destructive"
                onPress={() => {
                  close();
                  setAskDiscard(true);
                }}
              >
                Discard
              </Button>
              <Button
                onPress={() => {
                  close();
                  leave('/home', false);
                }}
              >
                Keep
              </Button>
            </SheetActions>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        isOpen={askDiscard}
        onOpenChange={setAskDiscard}
        title="Discard this brew?"
        message="Nothing is saved, and the recipe stays as it is."
        confirmLabel="Discard"
        cancelLabel="Back to log"
        tone="destructive"
        onConfirm={() => {
          setAskDiscard(false);
          leave('/home', true);
        }}
      />
    </>
  );
}
