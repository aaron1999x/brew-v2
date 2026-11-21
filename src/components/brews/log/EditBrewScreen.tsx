'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { NotAvailable } from '@/components/feedback/NotAvailable';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { useUnsavedGuard } from '@/components/recipes/editor/useUnsavedGuard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { Notice } from '@/components/ui/Notice/Notice';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { toast } from '@/components/ui/Toast/toast';
import { CHANGE_NOTE_PREFIX } from '@/lib/brews/change-note';
import { NO_TARGETS } from '@/lib/brews/extraction';
import { formFromBrewRow } from '@/lib/brews/form';
import { useBrew, useUpdateBrew, type BrewDetailData } from '@/lib/brews/queries';
import type { BrewLogForm } from '@/lib/brews/schema';
import { toUserMessage } from '@/lib/errors/messages';
import { BrewLogFormView } from './BrewLogForm';
import styles from './BrewScreens.module.css';

const OFFLINE_EDIT = 'Editing a brew needs a connection for now. What you have changed is kept on this screen.';

/** `/brews/[id]/edit`: the same form, filled in from the saved brew. Version and quick change are fixed. */
export function EditBrewScreen({ id }: Readonly<{ id: string }>) {
  const query = useBrew(id);
  return (
    <div className={styles.page}>
      <QueryBoundary
        label="brew"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? <Editor data={query.data} /> : <NotAvailable />}
      </QueryBoundary>
    </div>
  );
}

function Editor({ data }: Readonly<{ data: BrewDetailData }>) {
  const router = useRouter();
  const online = useOnlineStatus();
  const update = useUpdateBrew();
  const { brew, version } = data;
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedGuard(dirty, `/brews/${brew.id}`);
  const initial = useMemo(() => formFromBrewRow(brew), [brew]);
  const note = version?.change_note?.startsWith(CHANGE_NOTE_PREFIX) ? version.change_note : null;
  const showDrawdown =
    brew.drawdown_s != null ||
    (version ? version.drawdown_min_s != null || version.drawdown_max_s != null : false);

  function save(form: BrewLogForm) {
    if (!online) {
      toast.error(OFFLINE_EDIT);
      return;
    }
    update.mutate(
      { id: brew.id, form },
      {
        onSuccess: () => {
          toast.success('Brew updated');
          setDirty(false);
          router.replace(`/brews/${brew.id}`);
        },
        onError: (error) => toast.error(toUserMessage(error), { onRetry: () => save(form) }),
      },
    );
  }

  return (
    <>
      <BrewLogFormView
        key={brew.id}
        title="Edit brew"
        header={{
          recipeName: brew.recipe_name_snapshot,
          versionLabel: `v${brew.version_no_snapshot}`,
          changes: [],
          note: note ?? 'The recipe version this brew used can’t be changed.',
        }}
        initial={initial}
        context={{
          doseG: brew.dose_g_snapshot,
          brewWaterG: version?.brew_water_g ?? null,
          bypassG: version?.bypass_g ?? null,
          targets: version
            ? {
                tdsMin: version.tds_min,
                tdsMax: version.tds_max,
                eyMin: version.ey_min,
                eyMax: version.ey_max,
                drawdownMinS: version.drawdown_min_s,
                drawdownMaxS: version.drawdown_max_s,
              }
            : NO_TARGETS,
          showDrawdown,
          storedEy: null,
        }}
        isSaving={update.isPending}
        notices={!online ? <Notice>{OFFLINE_EDIT}</Notice> : null}
        onSave={save}
        onCancel={guard.requestCancel}
        onDirtyChange={setDirty}
      />
      <ConfirmDialog
        isOpen={guard.prompt !== null}
        onOpenChange={(open) => {
          if (!open) guard.closePrompt();
        }}
        title="Discard your changes?"
        message="You haven't saved them yet, so they will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={guard.confirmLeave}
      />
    </>
  );
}
