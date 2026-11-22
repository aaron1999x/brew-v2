'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { VersionBadge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Select } from '@/components/ui/Select/Select';
import { Sheet } from '@/components/ui/Sheet/Sheet';
import { toast } from '@/components/ui/Toast/toast';
import { currentUserId } from '@/lib/auth/useSession';
import { brewLogPath, brewTimerPath } from '@/lib/brews/paths';
import { createSession } from '@/lib/brews/sessions';
import { newSessionInput } from '@/lib/brews/start';
import { saveSession } from '@/lib/brews/useBrewSessions';
import { brewRatio, formatRatio } from '@/lib/recipes/calc';
import { versionByNo, type RecipeWithVersion } from '@/lib/recipes/fetch';
import { useRecipe } from '@/lib/recipes/hooks';
import { useUnits } from '@/lib/settings/useSettings';
import styles from './ChoiceSheet.module.css';

type Props = Readonly<{
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  handle: string;
  slug: string;
  /** The version to start from: the one on screen. The latest when left out. */
  versionNo?: number | null;
}>;

/**
 * The one way into a brew: the recipe, a version (the latest unless a version was being viewed),
 * then "Guided timer" or "Log only". Either creates a brew session on this device (nothing is saved
 * to the database until the log is saved) and opens it.
 */
export function ChoiceSheet({ isOpen, onOpenChange, handle, slug, versionNo = null }: Props) {
  const query = useRecipe(handle, slug);
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Brew this recipe">
      <QueryBoundary
        label="recipe"
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        {query.data ? (
          <ChoiceBody data={query.data} initialNo={versionNo} />
        ) : (
          <p>This recipe isn&apos;t available any more.</p>
        )}
      </QueryBoundary>
    </Sheet>
  );
}

function ChoiceBody({
  data,
  initialNo,
}: Readonly<{ data: RecipeWithVersion; initialNo: number | null }>) {
  const router = useRouter();
  const { weight } = useUnits();
  const latestNo = data.version.version_no;
  const [selectedNo, setSelectedNo] = useState(
    versionByNo(data.versions, initialNo) ? (initialNo ?? latestNo) : latestNo,
  );
  const [starting, setStarting] = useState<'timer' | 'log' | null>(null);
  const version = versionByNo(data.versions, selectedNo) ?? data.version;
  const ratio = formatRatio(brewRatio(version.dose_g, version.brew_water_g));

  async function start(entry: 'timer' | 'log') {
    setStarting(entry);
    try {
      const userId = await currentUserId();
      const session = createSession(newSessionInput(data, version, userId, entry));
      if (!saveSession(userId, session)) {
        toast.error("Couldn't start the brew on this phone. Check that your browser allows saving data.");
        setStarting(null);
        return;
      }
      router.push(
        entry === 'timer'
          ? brewTimerPath(data.owner.handle, data.recipe.slug, version.version_no, session.id)
          : brewLogPath(session.id),
      );
    } catch {
      toast.error('Please log in again to brew.');
      setStarting(null);
    }
  }

  return (
    <div className={styles.body}>
      <div>
        <p className={styles.name}>
          {data.recipe.name} <VersionBadge version={version.version_no} />
        </p>
        <p className={styles.numbers}>
          {[weight(version.dose_g), weight(version.brew_water_g), ratio].filter(Boolean).join(' · ')}
        </p>
      </div>
      {data.versions.length > 1 ? (
        <Select
          label="Change version"
          options={data.versions.map((v) => ({
            id: String(v.version_no),
            label: v.version_no === latestNo ? `v${v.version_no} (latest)` : `v${v.version_no}`,
          }))}
          selectedKey={String(selectedNo)}
          onSelectionChange={(key) => setSelectedNo(Number(key))}
        />
      ) : null}
      <div className={styles.actions}>
        <Button
          size="lg"
          fullWidth
          isDisabled={starting !== null}
          onPress={() => void start('timer')}
        >
          Guided timer
        </Button>
        <Button
          size="lg"
          variant="secondary"
          fullWidth
          isDisabled={starting !== null}
          onPress={() => void start('log')}
        >
          Log only
        </Button>
      </div>
    </div>
  );
}
