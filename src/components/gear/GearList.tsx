'use client';

import { Plus, Star, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Icon } from '@/components/ui/Icon/Icon';
import { toast } from '@/components/ui/Toast/toast';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { useDeleteGear, useGear, useGearCatalog } from '@/lib/gear/hooks';
import {
  GEAR_CATEGORIES,
  GEAR_CATEGORY_LABELS,
  gearDisplayName,
  gearRealName,
  type GearItem,
} from '@/lib/recipes/gear';
import { GearSheet } from './GearSheet';
import styles from './Gear.module.css';

type SheetState = { open: boolean; item: GearItem | null };

/** /settings/gear: my gear grouped by category, with add, edit, default and delete. */
export function GearList() {
  const gear = useGear();
  // Warm the catalogue, so the Add gear sheet's list is ready the moment it opens.
  useGearCatalog();
  const del = useDeleteGear();
  const [sheet, setSheet] = useState<SheetState>({ open: false, item: null });
  const [toDelete, setToDelete] = useState<GearItem | null>(null);

  const groups = useMemo(
    () =>
      GEAR_CATEGORIES.map((category) => ({
        category,
        items: (gear.data ?? []).filter((i) => i.category === category),
      })).filter((g) => g.items.length > 0),
    [gear.data],
  );

  const openAdd = () => setSheet({ open: true, item: null });

  return (
    <>
      <QueryBoundary
        label="your gear"
        isLoading={gear.isPending}
        isError={gear.isError}
        onRetry={() => void gear.refetch()}
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No gear yet"
            text="Add your brewer and grinder so new recipes fill in automatically."
            action={<Button onPress={openAdd}>Add gear</Button>}
          />
        ) : (
          <>
            <div className={styles.toolbar}>
              <Button onPress={openAdd}>
                <Icon icon={Plus} size="sm" /> Add gear
              </Button>
            </div>
            {groups.map(({ category, items }) => (
              <section
                key={category}
                className={styles.group}
                aria-labelledby={`gear-group-${category}`}
              >
                <h2 id={`gear-group-${category}`} className={styles.groupTitle}>
                  {GEAR_CATEGORY_LABELS[category]}
                </h2>
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={styles.row}
                        data-primary-control=""
                        onClick={() => setSheet({ open: true, item })}
                      >
                        <span className={styles.names}>
                          <span className={styles.name}>{gearDisplayName(item)}</span>
                          {item.nickname?.trim() ? (
                            <span className={styles.realName}>{gearRealName(item)}</span>
                          ) : null}
                        </span>
                        {item.is_default ? (
                          <Badge tone="accent" icon={Star}>
                            Default
                          </Badge>
                        ) : null}
                        <VisuallyHidden>, edit</VisuallyHidden>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </QueryBoundary>

      <GearSheet
        isOpen={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        item={sheet.item}
        onDelete={setToDelete}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={toDelete ? `Delete ${gearDisplayName(toDelete)}?` : 'Delete gear?'}
        message="Recipes that use it keep its name."
        confirmLabel="Delete"
        tone="destructive"
        isPending={del.isPending}
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await del.mutateAsync(toDelete.id);
            toast.success('Gear deleted.');
            setToDelete(null);
          } catch {
            // The hook showed the error toast; the dialog stays so it can be tried again.
          }
        }}
      />
    </>
  );
}
