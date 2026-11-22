'use client';

import { useState } from 'react';
import { AddTagField, TagChips } from '@/components/ui/Chips/Chips';
import { PRESET_FLAVOURS, addFlavour } from '@/lib/brews/schema';
import styles from './BrewLogForm.module.css';

const ADD_MESSAGES = {
  too_long: 'A flavour tag can be up to 30 characters.',
  too_many: 'Choose up to 12 flavours.',
  duplicate: 'That flavour is already added.',
  empty: '',
} as const;

/**
 * The prototype's preset flavours, then my recent custom tags, then "Add your own". Selecting toggles
 * a tag; a custom tag can be removed. Up to 12, 30 characters each, each once (ignoring case).
 */
export function FlavourPicker({
  value,
  recent,
  onChange,
}: Readonly<{ value: readonly string[]; recent: readonly string[]; onChange: (tags: string[]) => void }>) {
  const [message, setMessage] = useState('');
  const lower = (s: string) => s.trim().toLowerCase();
  const presets = new Set<string>(PRESET_FLAVOURS.map(lower));

  // Presets, then recent custom tags, then any chosen tag that is neither (typed this time).
  const custom: string[] = [];
  const seen = new Set(presets);
  for (const tag of [...recent, ...value]) {
    if (seen.has(lower(tag))) continue;
    seen.add(lower(tag));
    custom.push(tag);
  }
  const tags = [...PRESET_FLAVOURS, ...custom].map((label) => ({ id: label, label }));
  const selected = new Set(tags.filter((t) => value.some((v) => lower(v) === lower(t.id))).map((t) => t.id));

  return (
    <div className={styles.flavours}>
      <TagChips
        label="Flavours"
        tags={tags}
        selectedKeys={selected}
        onSelectionChange={(keys) => {
          setMessage('');
          // Keep the order they were chosen in: drop the ones switched off, then add the new ones.
          const kept = value.filter((v) => tags.some((t) => keys.has(t.id) && lower(t.id) === lower(v)));
          const added = tags.filter((t) => keys.has(t.id) && !kept.some((k) => lower(k) === lower(t.id)));
          const next = [...kept];
          for (const tag of added) {
            const result = addFlavour(next, tag.id);
            if (result.ok) next.splice(0, next.length, ...result.tags);
            else setMessage(ADD_MESSAGES[result.reason]);
          }
          onChange(next);
        }}
        onRemove={(id) => onChange(value.filter((v) => lower(v) !== lower(id)))}
        removableIds={new Set(custom)}
      />
      <AddTagField
        label="Add your own"
        onAdd={(text) => {
          const result = addFlavour(value, text);
          if (result.ok) {
            setMessage('');
            onChange(result.tags);
          } else setMessage(ADD_MESSAGES[result.reason]);
        }}
      />
      {message ? (
        <p role="status" className={styles.hintError}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
