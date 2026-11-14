/** Lower-cases and strips accents so "Café" matches "cafe". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Filters a list for a combobox. Every typed word must appear in the label (any order, case and
 * accent insensitive). Labels that start with the query rank first, then labels with a word that
 * starts with it, then the rest; ties keep the original order. An empty query returns everything.
 */
export function filterItems<T>(
  items: readonly T[],
  query: string,
  getLabel: (item: T) => string,
): T[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  const whole = words.join(' ');

  const scored: { item: T; rank: number; index: number }[] = [];
  items.forEach((item, index) => {
    const label = normalizeText(getLabel(item));
    if (!words.every((w) => label.includes(w))) return;
    const rank = label.startsWith(whole)
      ? 0
      : label.split(/\s+/).some((part) => part.startsWith(words[0]!))
        ? 1
        : 2;
    scored.push({ item, rank, index });
  });

  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).map((s) => s.item);
}

/** True when the typed text exactly equals one of the labels (ignoring case and accents). */
export function hasExactMatch<T>(
  items: readonly T[],
  text: string,
  getLabel: (item: T) => string,
): boolean {
  const target = normalizeText(text);
  return items.some((item) => normalizeText(getLabel(item)) === target);
}
