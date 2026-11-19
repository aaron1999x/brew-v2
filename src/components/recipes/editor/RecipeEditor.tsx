'use client';

import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryBoundary } from '@/components/feedback/QueryBoundary';
import { Button } from '@/components/ui/Button/Button';
import { Combobox } from '@/components/ui/Combobox/Combobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { DateField } from '@/components/ui/DateField/DateField';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { NumberField } from '@/components/ui/NumberField/NumberField';
import { Notice } from '@/components/ui/Notice/Notice';
import { useOnlineStatus } from '@/components/ui/OfflineBanner/OfflineBanner';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { Select } from '@/components/ui/Select/Select';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { toast } from '@/components/ui/Toast/toast';
import { DurationField } from '@/components/ui/UnitFields/DurationField';
import { TemperatureField } from '@/components/ui/UnitFields/TemperatureField';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden/VisuallyHidden';
import { WeightField } from '@/components/ui/UnitFields/WeightField';
import { useGear, useGearCatalog } from '@/lib/gear/hooks';
import { useProfileMe } from '@/lib/profile/useProfileMe';
import { formatRatio, recipeNumbers } from '@/lib/recipes/calc';
import {
  clearDeviceDraft,
  draftSignature,
  emptyDraft,
  fieldId,
  loadDeviceDraft,
  parseDraft,
  saveDeviceDraft,
  type DraftError,
  type RecipeDraft,
} from '@/lib/recipes/draft';
import {
  GEAR_CATEGORY_LABELS,
  RECIPE_GEAR_CATEGORIES,
  type GearChoice,
  type RecipeGearCategory,
} from '@/lib/recipes/gear';
import { saveErrorMessage, useCreateRecipe } from '@/lib/recipes/hooks';
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
import { recipePath } from '@/lib/recipes/paths';
import { LIMITS } from '@/lib/recipes/schema';
import { useUnits } from '@/lib/settings/useSettings';
import { RecipeGearPicker } from './RecipeGearPicker';
import { StepsEditor } from './StepsEditor';
import { useUnsavedGuard } from './useUnsavedGuard';
import styles from './RecipeEditor.module.css';

const OFFLINE_MESSAGE = 'Creating and editing recipes needs a connection';
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.fields}>{children}</div>
    </section>
  );
}

type PlainNumberProps = {
  id: string;
  label: string;
  description?: string;
  value: number | null;
  decimals?: number;
  onChange: (value: number | null) => void;
  error?: string;
};

/** A number with no unit of its own (altitude, grind size, TDS…). Empty is null. */
function PlainNumber({ id, label, description, value, decimals = 0, onChange, error }: PlainNumberProps) {
  return (
    <NumberField
      id={id}
      label={label}
      description={description}
      value={value ?? Number.NaN}
      formatOptions={{ maximumFractionDigits: decimals, useGrouping: false }}
      onChange={(next) => {
        if (Number.isNaN(next)) {
          if (value != null) onChange(null);
          return;
        }
        if (next !== value) onChange(next);
      }}
      isInvalid={Boolean(error)}
      errorMessage={error}
    />
  );
}

/**
 * The recipe editor (create). Sections follow the flow in docs/phase-2-ia-flows.md F4: basics, gear,
 * coffee, numbers, steps, targets and notes. Validates on submit and never disables Save; the error
 * summary takes focus and each entry jumps to its field. A copy is kept on this device, and leaving
 * with unsaved changes asks first.
 */
export function RecipeEditor() {
  const gear = useGear();
  const waiting = gear.isPending && gear.fetchStatus !== 'paused';
  return (
    <QueryBoundary
      label="your gear"
      isLoading={waiting}
      isError={false}
      onRetry={() => void gear.refetch()}
    >
      <EditorForm myGear={gear.data ?? []} />
    </QueryBoundary>
  );
}

function EditorForm({ myGear }: { myGear: NonNullable<ReturnType<typeof useGear>['data']> }) {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { weight, duration } = useUnits();
  const catalog = useGearCatalog();
  const profile = useProfileMe();
  const create = useCreateRecipe();

  const [initialDraft] = useState<RecipeDraft>(() => emptyDraft(myGear));
  const [initialSignature] = useState(() => draftSignature(initialDraft));
  const [draft, setDraft] = useState<RecipeDraft>(initialDraft);
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
      const saved = loadDeviceDraft();
      if (saved && draftSignature(saved) !== initialSignature) {
        setDraft(saved);
        setRestored(true);
        setFormKey((k) => k + 1);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSignature]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (dirty) saveDeviceDraft(draft);
      else clearDeviceDraft();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, ready]);

  const guard = useUnsavedGuard(dirty, '/recipes');

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

  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setText = (key: keyof RecipeDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

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

  // ---- save ----
  const [leaving, setLeaving] = useState(false);

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
      const recipe = await create.mutateAsync(parsed.values);
      clearDeviceDraft();
      setLeaving(true);
      toast.success('Saved as v1');
      const handle =
        profile.data?.handle ??
        queryClient.getQueryData<{ handle: string }>(['profile', 'me'])?.handle;
      guard.leaveTo(handle ? recipePath(handle, recipe.slug) : '/recipes');
    } catch (failure) {
      // The form stays as it is, so nothing typed is lost.
      toast.error(saveErrorMessage(failure));
    }
  }

  const methodOptions = BREW_METHODS.map((m) => ({ id: m, label: METHOD_LABELS[m] }));
  const roastOptions = [
    { id: NOT_SET, label: 'Not set' },
    ...ROAST_LEVELS.map((r) => ({ id: r, label: ROAST_LEVEL_LABELS[r] })),
  ];
  const pending = create.isPending || leaving;
  const choiceFor = (c: RecipeGearCategory): GearChoice | null => draft.gear[c] ?? null;

  return (
    <>
      <form
        key={formKey}
        id="recipe-form"
        onSubmit={onSubmit}
        noValidate
        aria-label="New recipe"
        className={styles.form}
      >
        <header className={styles.bar}>
          <Button variant="ghost" onPress={guard.requestCancel} isDisabled={pending}>
            Cancel
          </Button>
          <h1 className={styles.title}>New recipe</h1>
          <Button type="submit" isPending={pending} pendingLabel="Saving…">
            Save
          </Button>
        </header>

        <div className={styles.body}>
          {!online ? <Notice>{OFFLINE_MESSAGE}. What you have typed is kept.</Notice> : null}
          {restored ? (
            <div className={styles.restored}>
              <Notice>Restored your unsaved recipe.</Notice>
              <Button
                variant="secondary"
                onPress={() => {
                  clearDeviceDraft();
                  setDraft(emptyDraft(myGear));
                  setRestored(false);
                  setSubmitted(false);
                  setSummary([]);
                  setFormKey((k) => k + 1);
                }}
              >
                Discard it and start again
              </Button>
            </div>
          ) : null}

          <FormErrorSummary errors={summary} />

          <Section title="Basics">
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

          <Section title="Gear">
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

          <Section title="Coffee">
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
            <PlainNumber
              id={fieldId('altitude_m')}
              label="Altitude (metres)"
              value={draft.altitude_m}
              onChange={(v) => set('altitude_m', v)}
              error={error('altitude_m')}
            />
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
            <PlainNumber
              id={fieldId('colour_reading')}
              label="Roast colour reading"
              decimals={1}
              value={draft.colour_reading}
              onChange={(v) => set('colour_reading', v)}
              error={error('colour_reading')}
            />
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

          <Section title="Numbers">
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
            <div>
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
            <TextField
              id={fieldId('grind_setting')}
              label="Grind setting"
              placeholder="e.g. 24 clicks"
              maxLength={LIMITS.grindSetting}
              value={draft.grind_setting}
              onChange={setText('grind_setting')}
              errorMessage={error('grind_setting')}
              isInvalid={Boolean(error('grind_setting'))}
            />
            <div className={styles.pair}>
              <PlainNumber
                id={fieldId('grind_microns')}
                label="Grind size (µm)"
                value={draft.grind_microns}
                onChange={(v) => set('grind_microns', v)}
                error={error('grind_microns')}
              />
              <PlainNumber
                id={fieldId('water_ppm')}
                label="Water hardness (ppm)"
                value={draft.water_ppm}
                onChange={(v) => set('water_ppm', v)}
                error={error('water_ppm')}
              />
            </div>
            <PlainNumber
              id={fieldId('retention_ratio')}
              label="Retention (g water per g coffee)"
              description="Leave empty to use 2.0"
              decimals={1}
              value={draft.retention_ratio}
              onChange={(v) => set('retention_ratio', v)}
              error={error('retention_ratio')}
            />

            <div className={styles.numbers}>
              <h3 className={styles.numbersTitle}>Calculated</h3>
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
              <VisuallyHidden>
                <span role="status">{announced}</span>
              </VisuallyHidden>
            </div>
          </Section>

          <Section title="Steps">
            <StepsEditor
              steps={draft.steps}
              onChange={(steps) => set('steps', steps)}
              varyTemp={draft.vary_temp}
              onVaryTempChange={(on) => set('vary_temp', on)}
              context={{ dose_g: draft.dose_g, brew_water_g: draft.brew_water_g }}
              errors={live}
            />
          </Section>

          <Section title="Targets">
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
              <PlainNumber
                id={fieldId('tds_min')}
                label="TDS % lowest"
                decimals={2}
                value={draft.tds_min}
                onChange={(v) => set('tds_min', v)}
                error={error('tds_min')}
              />
              <PlainNumber
                id={fieldId('tds_max')}
                label="TDS % highest"
                decimals={2}
                value={draft.tds_max}
                onChange={(v) => set('tds_max', v)}
                error={error('tds_max')}
              />
            </div>
            <div className={styles.pair}>
              <PlainNumber
                id={fieldId('ey_min')}
                label="Extraction % lowest"
                decimals={1}
                value={draft.ey_min}
                onChange={(v) => set('ey_min', v)}
                error={error('ey_min')}
              />
              <PlainNumber
                id={fieldId('ey_max')}
                label="Extraction % highest"
                decimals={1}
                value={draft.ey_max}
                onChange={(v) => set('ey_max', v)}
                error={error('ey_max')}
              />
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

          <div className={styles.footer}>
            <Button type="submit" size="lg" fullWidth isPending={pending} pendingLabel="Saving…">
              Save recipe
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={guard.prompt !== null}
        onOpenChange={(open) => {
          if (!open) guard.closePrompt();
        }}
        title="Discard this recipe?"
        message="You haven't saved it yet, so what you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          clearDeviceDraft();
          guard.confirmLeave();
        }}
      />
    </>
  );
}
