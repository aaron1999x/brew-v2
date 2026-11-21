'use client';

import { useDeferredValue, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { DateField } from '@/components/ui/DateField/DateField';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TypedNumberField } from '@/components/ui/NumberField/TypedNumberField';
import { Notice } from '@/components/ui/Notice/Notice';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { Select } from '@/components/ui/Select/Select';
import { ChevronDown } from 'lucide-react';
import { GRIND_INPUT_PROPS } from '@/components/brews/QuickChangePanel';
import { Icon } from '@/components/ui/Icon/Icon';
import { Switch } from '@/components/ui/Switch/Switch';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { toast } from '@/components/ui/Toast/toast';
import { DurationField } from '@/components/ui/UnitFields/DurationField';
import { TemperatureField } from '@/components/ui/UnitFields/TemperatureField';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { WeightField } from '@/components/ui/UnitFields/WeightField';
import { useSession } from '@/lib/auth/useSession';
import { useGear, useGearCatalog } from '@/lib/gear/hooks';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import { queryKeys } from '@/lib/query/keys';
import { formatRatio, recipeNumbers } from '@/lib/recipes/calc';
import { diffVersions } from '@/lib/recipes/diff';
import {
  newRecipeDraftKey,
  clearDeviceDraft,
  draftFromVersion,
  draftSignature,
  emptyDraft,
  fieldId,
  loadDeviceDraft,
  parseDraft,
  saveDeviceDraft,
  type DraftError,
  type RecipeDraft,
} from '@/lib/recipes/draft';
import type { RecipeRow, VersionRow } from '@/lib/recipes/fetch';
import {
  GEAR_CATEGORY_LABELS,
  RECIPE_GEAR_CATEGORIES,
  type GearChoice,
  type RecipeGearCategory,
} from '@/lib/recipes/gear';
import { saveErrorMessage, useCreateRecipe, useSaveRecipe } from '@/lib/recipes/hooks';
import {
  BREW_METHODS,
  BYPASS_TIMINGS,
  BYPASS_TIMING_LABELS,
  COLOUR_SCALE_PRESETS,
  METHOD_CUSTOM_MAX,
  METHOD_LABELS,
  PROCESS_PRESETS,
  ROAST_LEVELS,
  ROAST_LEVEL_LABELS,
  type BrewMethod,
  type BypassTiming,
  type RoastLevel,
} from '@/lib/recipes/methods';
import { recipePath, versionOrLatestPath } from '@/lib/recipes/paths';
import {
  changeSummary,
  decideSave,
  formDiffInput,
  storedDiffInput,
  type EditorMode,
} from '@/lib/recipes/save';
import { LIMITS, type NumberHelpKey } from '@/lib/recipes/schema';
import { pourTemperatureTrail, setVaryTemperature } from '@/lib/recipes/steps';
import { useUnits } from '@/lib/settings/useSettings';
import { useMediaQuery } from '@/lib/ui/useMediaQuery';
import { DiffSections } from '../Changes';
import { LazyPourCurve } from '../LazyPourCurve';
import { RecipeGearPicker } from './RecipeGearPicker';
import { StepsEditor } from './StepsEditor';
import { useUnsavedGuard } from './useUnsavedGuard';
import styles from './RecipeEditor.module.css';

const OFFLINE_MESSAGE = 'Creating and editing recipes needs a connection';
const LOCKED_NOW_MESSAGE =
  'This version now has brews. Save again to save your changes as a new version.';
const NOT_SET = 'none';

/** Waits `ms` after the last change before using a value (for screen-reader announcements). */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Sorts errors into the order their fields appear on the page, so the summary reads top-down. */
function sortByPosition(errors: DraftError[]): DraftError[] {
  const position = (id: string) => document.getElementById(id);
  return [...errors].sort((a, b) => {
    const first = position(a.fieldId);
    const second = position(b.fieldId);
    if (!first || !second) return 0;
    return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/** How a section lays out its fields from 768 px: two across, three across, or pairs of targets. */
const FIELD_LAYOUTS = {
  two: styles.fieldsTwo,
  three: styles.fieldsThree,
  targets: styles.fieldsTargets,
} as const;

function Section({
  title,
  children,
  layout,
}: {
  title: string;
  children: ReactNode;
  layout?: keyof typeof FIELD_LAYOUTS;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={layout ? `${styles.fields} ${FIELD_LAYOUTS[layout]}` : styles.fields}>
        {children}
      </div>
    </section>
  );
}

type MoreOptionsProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}>;

/**
 * Rarely used fields behind a "More options" button. It opens by itself when one of them has an
 * error, so the error summary can always take you to the field.
 */
function MoreOptions({ open, onOpenChange, children }: MoreOptionsProps) {
  const panelId = useId();
  return (
    <div className={styles.more}>
      <button
        type="button"
        className={styles.moreToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        data-primary-control=""
      >
        <span>More options</span>
        <span className={open ? styles.moreOpen : styles.moreClosed}>
          <Icon icon={ChevronDown} size="md" />
        </span>
      </button>
      <div id={panelId} hidden={!open} className={styles.moreFields}>
        {children}
      </div>
    </div>
  );
}

/** The version an edit or a new version starts from (the page fetches it on the server). */
export type EditorBase = {
  handle: string;
  recipe: RecipeRow;
  version: VersionRow;
  /** The recipe's newest version number: a new version is the next one after this. */
  latestNo: number;
};

type EditorProps = Readonly<{ mode?: EditorMode; base?: EditorBase }>;

/**
 * The recipe editor: a new recipe, an edit of one version, or the next version started from a
 * version. Sections follow the flow in docs/phase-2-ia-flows.md F4: basics, gear, coffee, numbers,
 * steps, targets and notes. Validates on submit and never disables Save; the error summary takes
 * focus and each entry jumps to its field. A copy is kept on this device, and leaving with unsaved
 * changes asks first.
 */
export function RecipeEditor({ mode = 'create', base }: EditorProps) {
  const gear = useGear();
  const waiting = gear.isPending && gear.fetchStatus !== 'paused';
  return (
    <QueryBoundary
      label="your gear"
      isLoading={waiting}
      isError={false}
      onRetry={() => void gear.refetch()}
    >
      <EditorForm myGear={gear.data ?? []} mode={mode} base={base} />
    </QueryBoundary>
  );
}

const MODE_TITLE: Record<EditorMode, (base?: EditorBase) => string> = {
  create: () => 'New recipe',
  edit: (base) => `Edit v${base?.version.version_no ?? ''}`,
  'new-version': () => 'New version',
};

function EditorForm({
  myGear,
  mode,
  base,
}: Readonly<{
  myGear: NonNullable<ReturnType<typeof useGear>['data']>;
  mode: EditorMode;
  base?: EditorBase;
}>) {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { weight, duration, temp } = useUnits();
  const catalog = useGearCatalog();
  const profile = useProfileMe();
  const { user } = useSession();
  const create = useCreateRecipe();
  const saveRecipe = useSaveRecipe();
  const editing = mode !== 'create' && base !== undefined;
  const title = MODE_TITLE[mode](base);
  // One copy per person, recipe, version and kind of edit, so two recipes never share a draft.
  const draftKey = editing
    ? `recipe-draft:${user?.id ?? 'me'}:${base.recipe.id}:${base.version.id}:${mode}`
    : newRecipeDraftKey(user?.id);

  const [initialDraft] = useState<RecipeDraft>(() =>
    editing
      ? draftFromVersion(base.recipe, base.version, { keepChangeNote: mode === 'edit' })
      : emptyDraft(myGear),
  );
  const [initialSignature] = useState(() => draftSignature(initialDraft));
  const [draft, setDraft] = useState<RecipeDraft>(initialDraft);
  // "More options" (particle size, retention) starts open when it already holds something.
  const [moreUserOpen, setMoreUserOpen] = useState(
    () => initialDraft.grind_microns != null || initialDraft.retention_ratio != null,
  );
  const dirty = draftSignature(draft) !== initialSignature;

  // ---- the copy on this device ----
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  // Fields that read their starting value once (pickers, comboboxes) start afresh when this changes.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    // Storage only exists in the browser, so this runs after the first render (and not
    // synchronously, so the page never paints a half-restored form).
    const timer = window.setTimeout(() => {
      const saved = loadDeviceDraft(draftKey);
      if (saved && draftSignature(saved) !== initialSignature) {
        setDraft(saved);
        setRestored(true);
        if (saved.grind_microns != null || saved.retention_ratio != null || saved.typed?.grind_microns !== undefined) {
          setMoreUserOpen(true);
        }
        setFormKey((k) => k + 1);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSignature, draftKey]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (dirty) saveDeviceDraft(draft, draftKey);
      else clearDeviceDraft(draftKey);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, ready, draftKey]);

  // Leaving without saving goes back to the recipe (or the list, for a new one).
  const guard = useUnsavedGuard(
    dirty,
    editing ? recipePath(base.handle, base.recipe.slug) : '/recipes',
  );

  // ---- errors ----
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState<DraftError[]>([]);
  const live = useMemo(() => {
    if (!submitted) return {} as Record<string, string>;
    const parsed = parseDraft(draft);
    return parsed.ok
      ? {}
      : Object.fromEntries(parsed.errors.map((e) => [e.fieldId, e.message]));
  }, [submitted, draft]);
  const error = (key: string) => live[fieldId(key)];
  // It opens by itself for an error in one of its fields, so the error summary can reach the field.
  const moreOpen = moreUserOpen || Boolean(error('grind_microns') || error('retention_ratio'));

  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setText = (key: keyof RecipeDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /**
   * The props of a plain-number field: its number, the text kept when it isn't a number, how to
   * change them, and its message. Typing never gets refused; saving says what is wrong.
   */
  const numberProps = (key: NumberHelpKey) => ({
    id: fieldId(key),
    value: draft[key],
    typed: draft.typed[key],
    error: error(key),
    onChange: (value: number | null, typed?: string) =>
      setDraft((d) => {
        const nextTyped = { ...d.typed };
        if (typed === undefined) delete nextTyped[key];
        else nextTyped[key] = typed;
        return { ...d, [key]: value, typed: nextTyped };
      }),
  });

  // The hint under "Vary temperature by pour": what every pour uses, or the temperatures chosen.
  const trail = pourTemperatureTrail(draft.steps, draft.temp_c);
  const varyTempHint = draft.vary_temp
    ? `Each pour sets its own temperature in Steps${trail.length > 0 ? ` · ${trail.map((t) => temp(t)).join(' → ')}` : ''}`
    : draft.temp_c != null
      ? `Every pour uses ${temp(draft.temp_c)}`
      : 'Every pour uses the water temperature';

  // ---- live numbers ----
  const numbers = recipeNumbers({
    dose_g: draft.dose_g,
    brew_water_g: draft.brew_water_g,
    bypass_g: draft.bypass_g,
    retention_ratio: draft.retention_ratio,
    steps: draft.steps,
  });
  const ratio = formatRatio(numbers.ratio);
  const overall = numbers.overallRatio !== numbers.ratio ? formatRatio(numbers.overallRatio) : null;
  const summaryLine = [
    ratio ? `Ratio ${ratio}` : null,
    overall ? `Overall ${overall}` : null,
    numbers.expectedFinalVolumeG != null
      ? `Expected volume ${weight(numbers.expectedFinalVolumeG)}`
      : null,
    numbers.totalTimeS != null ? `Total time ${duration(numbers.totalTimeS)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const announced = useDebounced(summaryLine, 800);

  // The four numbers show inside the form on a phone and tablet, and in a side panel from 1024 px.
  // From 1024 px the pour curve also shows under the steps.
  const wide = useMediaQuery('(min-width: 1024px)');
  const panelId = useId();
  const curveSteps = useDeferredValue(draft.steps);
  const curveSeries = useMemo(
    () => [{ id: 'draft', label: 'Draft', steps: curveSteps }],
    [curveSteps],
  );
  const hasCurve = curveSteps.some((s) => s.kind === 'pour' && s.target_g != null);
  const curveDrawdown =
    draft.drawdown_min_s != null || draft.drawdown_max_s != null
      ? {
          from: draft.drawdown_min_s ?? draft.drawdown_max_s ?? 0,
          to: draft.drawdown_max_s ?? draft.drawdown_min_s ?? 0,
        }
      : null;

  // A brew on another tab or device can lock this version while the editor is open. The database
  // says so on save (`version_locked`); from then on the editor plans a new version instead.
  const [lockedNow, setLockedNow] = useState(false);

  // ---- what saving would do (edit and new version) ----
  const plan = useMemo(() => {
    if (!editing) return null;
    const parsed = parseDraft(draft);
    if (!parsed.ok) return null;
    const diff = diffVersions(
      storedDiffInput(base.recipe, base.version),
      formDiffInput(parsed.values),
    );
    const noteChanged =
      mode === 'edit' &&
      (parsed.values.version.change_note ?? '') !== (base.version.change_note ?? '');
    const action = decideSave({
      mode: mode === 'edit' ? 'edit' : 'new-version',
      locked: base.version.locked_at !== null || lockedNow,
      diff,
      noteChanged,
    });
    return { diff, action, values: parsed.values };
  }, [editing, draft, base, mode, lockedNow]);
  const nextNo = (base?.latestNo ?? 0) + 1;
  const saveLabel =
    plan?.action === 'new-version'
      ? `Save as v${nextNo}`
      : plan?.action === 'in-place'
        ? 'Save changes'
        : mode === 'create'
          ? 'Save recipe'
          : 'Save';

  // ---- save ----
  const [leaving, setLeaving] = useState(false);
  const [nothingChanged, setNothingChanged] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    setSubmitted(true);
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setSummary(sortByPosition(parsed.errors));
      return;
    }
    setSummary([]);
    try {
      if (!editing) {
        const recipe = await create.mutateAsync(parsed.values);
        clearDeviceDraft(draftKey);
        setLeaving(true);
        toast.success('Saved as v1');
        const handle =
          profile.data?.handle ??
          queryClient.getQueryData<{ handle: string }>(queryKeys.profileMe())?.handle;
        guard.leaveTo(handle ? recipePath(handle, recipe.slug) : '/recipes');
        return;
      }

      if (!plan || plan.action === 'nothing') {
        // Not an error and not a save: nothing differs from the version it started from.
        setNothingChanged(true);
        return;
      }
      setNothingChanged(false);
      const asNew = plan.action === 'new-version';
      const saved = await saveRecipe.mutateAsync({
        recipeId: base.recipe.id,
        baseVersionId: base.version.id,
        values: parsed.values,
        asNewVersion: asNew,
      });
      clearDeviceDraft(draftKey);
      setLeaving(true);
      toast.success(asNew ? `Saved as v${saved.version_no}` : `v${saved.version_no} updated`);
      // A new version is the latest; an edit in place goes back to the version that was edited.
      const latest = asNew ? saved.version_no : base.latestNo;
      guard.leaveTo(
        versionOrLatestPath(base.handle, base.recipe.slug, saved.version_no, latest),
      );
    } catch (failure) {
      // The form stays as it is, so nothing typed is lost.
      if (editing && String((failure as { message?: unknown })?.message ?? '').includes('version_locked')) {
        setLockedNow(true);
        toast.error(LOCKED_NOW_MESSAGE);
        return;
      }
      toast.error(saveErrorMessage(failure));
    }
  }

  const liveList = (
    <dl className={styles.numbersList}>
      <div>
        <dt>Ratio</dt>
        <dd className="num">{ratio ?? '–'}</dd>
      </div>
      <div>
        <dt>Overall ratio</dt>
        <dd className="num">{formatRatio(numbers.overallRatio) ?? '–'}</dd>
      </div>
      <div>
        <dt>Expected volume</dt>
        <dd className="num">
          {numbers.expectedFinalVolumeG != null ? weight(numbers.expectedFinalVolumeG) : '–'}
        </dd>
      </div>
      <div>
        <dt>Total time</dt>
        <dd className="num">
          {numbers.totalTimeS != null ? duration(numbers.totalTimeS) : '–'}
        </dd>
      </div>
    </dl>
  );

  const methodOptions = BREW_METHODS.map((m) => ({ id: m, label: METHOD_LABELS[m] }));
  const roastOptions = [
    { id: NOT_SET, label: 'Not set' },
    ...ROAST_LEVELS.map((r) => ({ id: r, label: ROAST_LEVEL_LABELS[r] })),
  ];
  const pending = create.isPending || saveRecipe.isPending || leaving;
  const choiceFor = (c: RecipeGearCategory): GearChoice | null => draft.gear[c] ?? null;

  return (
    <>
      <form
        key={formKey}
        id="recipe-form"
        onSubmit={onSubmit}
        noValidate
        aria-label={title}
        className={styles.form}
      >
        <header className={styles.bar}>
          <Button variant="ghost" onPress={guard.requestCancel} isDisabled={pending}>
            Cancel
          </Button>
          <h1 className={styles.title}>{title}</h1>
          <Button type="submit" isPending={pending} pendingLabel="Saving…">
            Save
          </Button>
        </header>

        <div className={styles.body}>
          {!online ? <Notice>{OFFLINE_MESSAGE}. What you have typed is kept.</Notice> : null}
          {mode === 'edit' && (base?.version.locked_at || lockedNow) ? (
            <Notice>
              This version has brews, so your changes will be saved as a new version.
            </Notice>
          ) : null}
          {restored ? (
            <div className={styles.restored}>
              <Notice>
                {editing ? 'Restored your unsaved changes.' : 'Restored your unsaved recipe.'}
              </Notice>
              <Button
                variant="secondary"
                onPress={() => {
                  clearDeviceDraft(draftKey);
                  setDraft(initialDraft);
                  setRestored(false);
                  setSubmitted(false);
                  setSummary([]);
                  setFormKey((k) => k + 1);
                }}
              >
                {editing ? 'Discard them and start again' : 'Discard it and start again'}
              </Button>
            </div>
          ) : null}

          <FormErrorSummary errors={summary} />

          <div className={styles.columns}>
            <div className={styles.formColumn}>
              <Section title="Basics" layout="two">
                <TextField
                  id={fieldId('name')}
                  label="Name"
                  isRequired
                  maxLength={LIMITS.name}
                  value={draft.name}
                  onChange={setText('name')}
                  isInvalid={Boolean(live[fieldId('name')])}
                  errorMessage={live[fieldId('name')]}
                />
                <Select
                  id={fieldId('method')}
                  label="Method"
                  isRequired
                  placeholder="Choose a method"
                  options={methodOptions}
                  selectedKey={draft.method}
                  onSelectionChange={(key) => set('method', String(key) as BrewMethod)}
                  isInvalid={Boolean(live[fieldId('method')])}
                  errorMessage={live[fieldId('method')]}
                />
                {draft.method === 'other' ? (
                  <TextField
                    id={fieldId('method_custom')}
                    label="Method name"
                    isRequired
                    maxLength={METHOD_CUSTOM_MAX}
                    value={draft.method_custom}
                    onChange={setText('method_custom')}
                    isInvalid={Boolean(live[fieldId('method_custom')])}
                    errorMessage={live[fieldId('method_custom')]}
                  />
                ) : null}
              </Section>

              <Section title="Gear" layout="three">
                {RECIPE_GEAR_CATEGORIES.map((category) => (
                  <RecipeGearPicker
                    key={category}
                    id={`recipe-gear-${category}`}
                    label={GEAR_CATEGORY_LABELS[category]}
                    category={category}
                    myGear={myGear}
                    catalog={catalog.data ?? []}
                    isLoading={catalog.isPending}
                    value={choiceFor(category)}
                    onChange={(choice) =>
                      setDraft((d) => ({ ...d, gear: { ...d.gear, [category]: choice } }))
                    }
                  />
                ))}
              </Section>

              <Section title="Coffee" layout="three">
                <TextField
                  id={fieldId('coffee_name')}
                  label="Coffee"
                  maxLength={LIMITS.coffeeText}
                  value={draft.coffee_name}
                  onChange={setText('coffee_name')}
                  errorMessage={error('coffee_name')}
                  isInvalid={Boolean(error('coffee_name'))}
                />
                <TextField
                  id={fieldId('roaster')}
                  label="Roaster"
                  maxLength={LIMITS.coffeeText}
                  value={draft.roaster}
                  onChange={setText('roaster')}
                  errorMessage={error('roaster')}
                  isInvalid={Boolean(error('roaster'))}
                />
                <TextField
                  id={fieldId('origin')}
                  label="Origin"
                  maxLength={LIMITS.coffeeText}
                  value={draft.origin}
                  onChange={setText('origin')}
                  errorMessage={error('origin')}
                  isInvalid={Boolean(error('origin'))}
                />
                <Combobox
                  id={fieldId('process')}
                  label="Process"
                  items={PROCESS_PRESETS.map((p) => ({ id: p, label: p }))}
                  allowsCustomValue
                  customOptionLabel={(t) => `Use “${t}”`}
                  defaultText={draft.process || undefined}
                  onTextChange={(text) => set('process', text)}
                  errorMessage={error('process')}
                  isInvalid={Boolean(error('process'))}
                />
                <TextField
                  id={fieldId('varietal')}
                  label="Varietal"
                  maxLength={LIMITS.coffeeText}
                  value={draft.varietal}
                  onChange={setText('varietal')}
                  errorMessage={error('varietal')}
                  isInvalid={Boolean(error('varietal'))}
                />
                <TypedNumberField label="Altitude (metres)" {...numberProps('altitude_m')} />
                <Select
                  id={fieldId('roast_level')}
                  label="Roast level"
                  options={roastOptions}
                  selectedKey={draft.roast_level ?? NOT_SET}
                  onSelectionChange={(key) =>
                    set('roast_level', key === NOT_SET ? null : (String(key) as RoastLevel))
                  }
                />
                <DateField
                  id={fieldId('roast_date')}
                  label="Roast date"
                  value={draft.roast_date}
                  onChange={(v) => set('roast_date', v)}
                  isInvalid={Boolean(error('roast_date'))}
                  errorMessage={error('roast_date')}
                />
                <TypedNumberField label="Roast colour reading" {...numberProps('colour_reading')} />
                <Combobox
                  id={fieldId('colour_scale')}
                  label="Colour scale"
                  items={COLOUR_SCALE_PRESETS.map((p) => ({ id: p, label: p }))}
                  allowsCustomValue
                  customOptionLabel={(t) => `Use “${t}”`}
                  defaultText={draft.colour_scale || undefined}
                  onTextChange={(text) => set('colour_scale', text)}
                  errorMessage={error('colour_scale')}
                  isInvalid={Boolean(error('colour_scale'))}
                />
              </Section>

              <Section title="Numbers" layout="three">
                <div className={styles.pair}>
                  <WeightField
                    id={fieldId('dose_g')}
                    label="Coffee dose"
                    isRequired
                    min={0}
                    value={draft.dose_g}
                    onChange={(v) => set('dose_g', v)}
                    isInvalid={Boolean(error('dose_g'))}
                    errorMessage={error('dose_g')}
                  />
                  <WeightField
                    id={fieldId('brew_water_g')}
                    label="Brew water"
                    isRequired
                    min={0}
                    value={draft.brew_water_g}
                    onChange={(v) => set('brew_water_g', v)}
                    isInvalid={Boolean(error('brew_water_g'))}
                    errorMessage={error('brew_water_g')}
                  />
                </div>
                <WeightField
                  id={fieldId('bypass_g')}
                  label="Bypass water (optional)"
                  description="Water added to the cup, not through the coffee"
                  min={0}
                  value={draft.bypass_g}
                  onChange={(v) => set('bypass_g', v)}
                  isInvalid={Boolean(error('bypass_g'))}
                  errorMessage={error('bypass_g')}
                />
                <div className={styles.wide}>
                  <SegmentedControl
                    id={fieldId('bypass_timing')}
                    label="Bypass goes in"
                    segments={BYPASS_TIMINGS.map((t) => ({ value: t, label: BYPASS_TIMING_LABELS[t] }))}
                    value={draft.bypass_timing}
                    onChange={(value) => set('bypass_timing', value as BypassTiming)}
                    isInvalid={Boolean(error('bypass_timing'))}
                  />
                  {error('bypass_timing') ? (
                    <p className={styles.fieldError}>{error('bypass_timing')}</p>
                  ) : null}
                </div>
                <TemperatureField
                  id={fieldId('temp_c')}
                  label="Water temperature"
                  min={0}
                  max={LIMITS.tempC}
                  value={draft.temp_c}
                  onChange={(v) => set('temp_c', v)}
                  isInvalid={Boolean(error('temp_c'))}
                  errorMessage={error('temp_c')}
                />
                {/* As in the prototype's Parameters card: right under the temperature it varies. */}
                <div className={styles.wide}>
                  <Switch
                    isSelected={draft.vary_temp}
                    onChange={(on) =>
                      setDraft((d) => ({
                        ...d,
                        vary_temp: on,
                        steps: setVaryTemperature(d.steps, on, d.temp_c),
                      }))
                    }
                  >
                    Vary temperature by pour
                  </Switch>
                  <p className={styles.note}>{varyTempHint}</p>
                </div>
                <TextField
                  id={fieldId('grind_setting')}
                  label="Grind setting"
                  description="As shown on your grinder"
                  placeholder="e.g. 7.5 or 24 clicks"
                  maxLength={LIMITS.grindSetting}
                  inputProps={GRIND_INPUT_PROPS}
                  value={draft.grind_setting}
                  onChange={setText('grind_setting')}
                  errorMessage={error('grind_setting')}
                  isInvalid={Boolean(error('grind_setting'))}
                />
                <TypedNumberField label="Water hardness (ppm)" {...numberProps('water_ppm')} />
                <div className={styles.wide}>
                  <MoreOptions open={moreOpen} onOpenChange={setMoreUserOpen}>
                    <TypedNumberField
                      label="Particle size (µm)"
                      description="Optional. Whole microns, e.g. 750"
                      {...numberProps('grind_microns')}
                    />
                    <TypedNumberField
                      label="Retention (g water per g coffee)"
                      description="Leave empty to use 2.0"
                      {...numberProps('retention_ratio')}
                    />
                  </MoreOptions>
                </div>

                <div className={styles.numbers}>
                  <h3 className={styles.numbersTitle}>Calculated</h3>
                  {liveList}
                </div>
                <VisuallyHidden>
                  <span role="status">{announced}</span>
                </VisuallyHidden>
              </Section>

              <Section title="Steps">
                <StepsEditor
                  steps={draft.steps}
                  onChange={(steps) => set('steps', steps)}
                  varyTemp={draft.vary_temp}
                  context={{ dose_g: draft.dose_g, brew_water_g: draft.brew_water_g }}
                  errors={live}
                />
                {wide ? (
                  hasCurve ? (
                    <LazyPourCurve series={curveSeries} drawdown={curveDrawdown} />
                  ) : (
                    <p className={styles.note}>Add a pour with a target to see the curve.</p>
                  )
                ) : null}
              </Section>

              <Section title="Targets" layout="targets">
                <p className={styles.note}>Optional. Used to check a brew against what you aimed for.</p>
                <div className={styles.pair}>
                  <DurationField
                    id={fieldId('drawdown_min_s')}
                    label="Drawdown, shortest"
                    value={draft.drawdown_min_s}
                    onChange={(v) => set('drawdown_min_s', v)}
                    errorMessage={error('drawdown_min_s')}
                  />
                  <DurationField
                    id={fieldId('drawdown_max_s')}
                    label="Drawdown, longest"
                    value={draft.drawdown_max_s}
                    onChange={(v) => set('drawdown_max_s', v)}
                    errorMessage={error('drawdown_max_s')}
                  />
                </div>
                <div className={styles.pair}>
                  <TypedNumberField label="TDS % lowest" {...numberProps('tds_min')} />
                  <TypedNumberField label="TDS % highest" {...numberProps('tds_max')} />
                </div>
                <div className={styles.pair}>
                  <TypedNumberField label="Extraction % lowest" {...numberProps('ey_min')} />
                  <TypedNumberField label="Extraction % highest" {...numberProps('ey_max')} />
                </div>
              </Section>

              <Section title="Notes">
                <div>
                  <Textarea
                    id={fieldId('notes')}
                    label="Notes (optional)"
                    value={draft.notes}
                    onChange={setText('notes')}
                    isInvalid={Boolean(error('notes'))}
                    errorMessage={error('notes')}
                  />
                  <p className={styles.counter} aria-live="polite">
                    {draft.notes.length}/{LIMITS.notes}
                  </p>
                </div>
              </Section>

              {editing ? (
                <Section title="Review and save">
                  <div className={styles.review} data-testid="review">
                    <p className={styles.reviewSummary} data-testid="change-summary" role="status">
                      {plan ? changeSummary(plan.diff.count) : 'Fill in the required fields to see what changed'}
                    </p>
                    {plan?.action === 'new-version' ? (
                      <p className={styles.note}>
                        {mode === 'new-version'
                          ? `Saves as v${nextNo}, and v${base.version.version_no} stays as it is.`
                          : `Saves as v${nextNo}, because v${base.version.version_no} has brews.`}
                      </p>
                    ) : null}
                    {plan?.action === 'in-place' ? (
                      <p className={styles.note}>Saves your changes to v{base.version.version_no}.</p>
                    ) : null}
                    {plan && plan.diff.count > 0 ? (
                      <details className={styles.changes}>
                        <summary className={styles.changesSummary}>See what changed</summary>
                        <DiffSections diff={plan.diff} />
                      </details>
                    ) : null}
                  </div>
                  <TextField
                    id={fieldId('change_note')}
                    label="Change note (optional)"
                    placeholder="e.g. finer grind, 92 °C"
                    maxLength={LIMITS.changeNote}
                    value={draft.change_note}
                    onChange={setText('change_note')}
                    isInvalid={Boolean(error('change_note'))}
                    errorMessage={error('change_note')}
                  />
                  {nothingChanged && plan?.action === 'nothing' ? (
                    <p className={styles.nothing} role="status">
                      Nothing has changed, so there is nothing to save. Change something, or cancel.
                    </p>
                  ) : null}
                </Section>
              ) : null}

              <div className={styles.footer}>
                <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Saving…">
                  {saveLabel}
                </Button>
              </div>
            </div>

            <section aria-labelledby={panelId} className={styles.panel}>
              <h2 id={panelId} className={styles.sectionTitle}>
                Live numbers
              </h2>
              {liveList}
            </section>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={guard.prompt !== null}
        onOpenChange={(open) => {
          if (!open) guard.closePrompt();
        }}
        title={editing ? 'Discard your changes?' : 'Discard this recipe?'}
        message={
          editing
            ? "You haven't saved them yet, so they will be lost."
            : "You haven't saved it yet, so what you typed will be lost."
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          clearDeviceDraft(draftKey);
          guard.confirmLeave();
        }}
      />
    </>
  );
}
