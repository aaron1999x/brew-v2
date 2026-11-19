'use client';

import { Archive, ArchiveRestore, Copy, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionMenu } from '@/components/ui/ActionMenu/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { toast } from '@/components/ui/Toast/toast';
import { useArchiveRecipe, useDeleteRecipe, useDuplicateRecipe } from '@/lib/recipes/lifecycle';
import { recipePath } from '@/lib/recipes/paths';

type Props = Readonly<{
  id: string;
  name: string;
  handle: string;
  slug: string;
  archived: boolean;
  /** The version to duplicate (the one on screen); the latest when left out. */
  versionNo?: number | null;
  /** Called after a delete is confirmed, e.g. to leave the recipe's own page. */
  onDeleted?: () => void;
}>;

/**
 * Duplicate, Archive or Restore, and Delete for one recipe: the menu on a list row and on the
 * recipe page. Delete asks first; archive and delete show at once and offer Undo.
 */
export function RecipeActions({ id, name, handle, slug, archived, versionNo, onDeleted }: Props) {
  const router = useRouter();
  const archive = useArchiveRecipe();
  const remove = useDeleteRecipe();
  const duplicate = useDuplicateRecipe();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <ActionMenu
        label={`Actions for ${name}`}
        items={[
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            onAction: () =>
              duplicate.mutate(
                { handle, slug, versionNo },
                {
                  onSuccess: (copy) => {
                    toast.success(`Created ${copy.name}`);
                    router.push(recipePath(handle, copy.slug));
                  },
                },
              ),
          },
          archived
            ? {
                id: 'restore',
                label: 'Restore',
                icon: ArchiveRestore,
                onAction: () => archive.mutate({ id, name, archived: false }),
              }
            : {
                id: 'archive',
                label: 'Archive',
                icon: Archive,
                onAction: () => archive.mutate({ id, name, archived: true }),
              },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onAction: () => setConfirmingDelete(true),
          },
        ]}
      />
      <ConfirmDialog
        isOpen={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${name}?`}
        message="Its versions are removed from your recipes. You can undo this for a few seconds afterwards."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {
          setConfirmingDelete(false);
          remove.mutate({ id, name, deleted: true });
          onDeleted?.();
        }}
      />
    </>
  );
}
