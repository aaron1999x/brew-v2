'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import {
  Badge,
  ChangedPill,
  SyncBadge,
  VerifiedBadge,
  VersionBadge,
  VisibilityBadge,
  type SyncState,
  type Visibility,
} from '@/components/ui/Badge/Badge';
import { AddTagField, FilterChip, TagChips, type ChipTag } from '@/components/ui/Chips/Chips';
import styles from './sections.module.css';

const methods = ['V60', 'AeroPress', 'Chemex', 'Espresso'];
const starterTags: ChipTag[] = [
  { id: 'jasmine', label: 'Jasmine' },
  { id: 'citrus', label: 'Citrus' },
  { id: 'caramel', label: 'Caramel' },
  { id: 'dark-chocolate', label: 'Dark chocolate' },
  {
    id: 'a-very-long-flavour-note-that-keeps-going',
    label: 'A very long flavour note that keeps going',
  },
];

const visibilities: Visibility[] = ['private', 'public', 'hidden'];
const syncStates: SyncState[] = ['saved', 'waiting', 'offline', 'attention'];

export function SelectionSection() {
  const [tags, setTags] = useState<ChipTag[]>(starterTags);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set(['citrus']));

  function addTag(text: string) {
    const id = `custom-${text.toLowerCase().replace(/\s+/g, '-')}`;
    if (tags.some((t) => t.id === id)) return;
    setTags([...tags, { id, label: text }]);
    setMine(new Set([...mine, id]));
    setSelected(new Set([...selected, id]));
  }

  function removeTag(id: string) {
    setTags(tags.filter((t) => t.id !== id));
    setMine(new Set([...mine].filter((m) => m !== id)));
    setSelected(new Set([...selected].filter((s) => s !== id)));
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Filter chips</h3>
        <div className={styles.row}>
          {methods.map((m) => (
            <FilterChip key={m} defaultSelected={m === 'V60'}>
              {m}
            </FilterChip>
          ))}
          <FilterChip isDisabled>Disabled</FilterChip>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Flavour tags</h3>
        <TagChips
          label="Flavour notes"
          tags={tags}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRemove={removeTag}
          removableIds={mine}
        />
        <AddTagField onAdd={addTag} />
        <TagChips
          label="Flavour notes (empty)"
          tags={[]}
          selectedKeys={[]}
          onSelectionChange={() => {}}
          emptyText="No flavour notes yet. Add your own below."
        />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Badges</h3>
        <div className={styles.row}>
          <VerifiedBadge />
          {visibilities.map((v) => (
            <VisibilityBadge key={v} visibility={v} />
          ))}
          <VersionBadge version={1} />
          <VersionBadge version={12} />
          <ChangedPill />
        </div>
        <div className={styles.row}>
          {syncStates.map((s) => (
            <SyncBadge key={s} state={s} />
          ))}
        </div>
        <div className={styles.row}>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Avatar</h3>
        <div className={styles.row}>
          <Avatar name="Aaron Tan" size="sm" />
          <Avatar name="Aaron Tan" size="md" />
          <Avatar name="Aaron Tan" size="lg" />
          <Avatar name="aaron" />
          <Avatar name="Zoë Łukasz-Nguyễn" />
          <Avatar name="   " />
          <Avatar name="Broken image" src="/this-image-does-not-exist.png" />
        </div>
      </div>
    </>
  );
}
