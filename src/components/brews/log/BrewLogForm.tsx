'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary/FormErrorSummary';
import { TypedNumberField } from '@/components/ui/NumberField/TypedNumberField';
import { Slider } from '@/components/ui/Slider/Slider';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { DurationField } from '@/components/ui/UnitFields/DurationField';
import { WeightField } from '@/components/ui/UnitFields/WeightField';
import { useUnits } from '@/lib/settings/useSettings';
import { extractionModel, type BrewTargets } from '@/lib/brews/extraction';
import {
  brewFieldId,
  checkBrewForm,
  fromLocalInput,
  tasteValues,
  toLocalInput,
  type TypedText,
} from '@/lib/brews/form';
import { useRecentFlavourTags } from '@/lib/brews/queries';
import { ATTRIBUTE_KEYS, BREW_LIMITS, TASTE_LABELS, type BrewLogForm } from '@/lib/brews/schema';
import { ExtractionPanel, TargetNote, targetTexts } from './ExtractionPanel';
import { FlavourPicker } from './FlavourPicker';
import { LazyTasteRadar } from './LazyTasteRadar';
import { TastedAt } from './TastedAt';
import { OverallSlider } from './TasteSlider';
import cards from './BrewCards.module.css';
import styles from './BrewLogForm.module.css';

export type BrewFormContext = {
  doseG: number | null;
  brewWaterG: number | null;
  bypassG: number | null;
  targets: BrewTargets;
  /** Drawdown is asked for pour-over and hybrid, or when the version has a drawdown target. */
  showDrawdown: boolean;
  /** The database's own extraction yield, on a saved brew. */
  storedEy?: number | null;
};

type Props = Readonly<{
  title: string;
  /** The recipe and version, shown at the top; `changes` are the quick-change chips. */
  header: { recipeName: string; versionLabel: string; changes: readonly string[]; note?: string | null };
  initial: BrewLogForm;
  initialTyped?: TypedText;
  context: BrewFormContext;
  isSaving: boolean;
  saveLabel?: string;
  /** Shown above the form: offline, restored, and so on. */
  notices?: ReactNode;
  /** In the Setup card under the version chips (Log only: "Brewed with a change?"). */
  setupExtra?: ReactNode;
  /** Called whenever the form changes (the parent keeps the draft, debounced). */
  onChange?: (form: BrewLogForm, typed: TypedText) => void;
  onSave: (form: BrewLogForm) => void;
  onCancel: () => void;
  /** Reports whether the form differs from how it started. */
  onDirtyChange?: (dirty: boolean) => void;
}>;

/**
 * The brew log, in the prototype's order: header, results, extraction, taste (sliders and a live
 * radar), flavours, tasted at, notes, next time. Shared by "Log brew" and "Edit brew". Only the
 * overall score is required; saving without it focuses the error summary. Save is never disabled.
 */
export function BrewLogFormView({
  title,
  header,
  initial,
  initialTyped,
  context,
  isSaving,
  saveLabel = 'Save',
  notices,
  setupExtra,
  onChange,
  onSave,
  onCancel,
  onDirtyChange,
}: Props) {
  const [form, setForm] = useState<BrewLogForm>(initial);
  const [typed, setTyped] = useState<TypedText>(initialTyped ?? {});
  const [brewedText, setBrewedText] = useState(toLocalInput(initial.brewedAt));
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState<{ fieldId: string; message: string }[]>([]);
  const recent = useRecentFlavourTags();

  const set = <K extends keyof BrewLogForm>(key: K, value: BrewLogForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setTypedText = (key: keyof TypedText, text: string | undefined) =>
    setTyped((t) => {
      const next = { ...t };
      if (text === undefined) delete next[key];
      else next[key] = text;
      return next;
    });

  // Tell the parent about every change after the first render, and whether anything differs.
  const initialJson = useRef(JSON.stringify(initial));
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    onChange?.(form, typed);
  }, [form, typed, onChange]);
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialJson.current);
  }, [form, onDirtyChange]);

  // After the first Save, the messages follow the form as it is fixed.
  const issues = useMemo(() => {
    if (!submitted) return [];
    const result = checkBrewForm(form, typed);
    return result.ok ? [] : result.issues;
  }, [submitted, form, typed]);
  const errorOf = (key: keyof BrewLogForm): string | undefined =>
    issues.find((i) => i.field === key)?.message;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const result = checkBrewForm(form, typed);
    if (!result.ok) {
      setSummary(
        result.issues.map((i) => ({ fieldId: brewFieldId(i.field), message: i.message })),
      );
      return;
    }
    setSummary([]);
    onSave(result.data);
  }

  const model = extractionModel({
    doseG: context.doseG,
    brewWaterG: context.brewWaterG,
    bypassG: context.bypassG,
    tdsPct: form.tdsPct,
    beverageG: form.beverageG,
    drawdownS: form.drawdownS,
    targets: context.targets,
    storedEy: context.storedEy,
  });
  const scores = tasteValues(form);
  const nowLocal = toLocalInput(new Date().toISOString());

  const { duration } = useUnits();
  const targetText = targetTexts(model, duration);
  const overallText = form.overall == null ? 'Not scored' : form.overall.toFixed(1);
  return (
    <form id="brew-form" onSubmit={submit} noValidate aria-label={title} className={cards.wrap}>
      <div className={styles.form}>
        <header className={styles.bar}>
          <Button variant="ghost" onPress={onCancel} isDisabled={isSaving}>
            Cancel
          </Button>
          <h1 className={styles.title}>{title}</h1>
          <Button type="submit" isPending={isSaving} pendingLabel="Saving…">
            {saveLabel}
          </Button>
        </header>

        <div className={styles.body}>
          {notices}
          <FormErrorSummary errors={summary} />

          <div className={cards.cards}>
            <section aria-labelledby="brew-setup" className={cards.card}>
              <h2 id="brew-setup" className={cards.cardTitle}>
                Setup
              </h2>
              <div className={styles.nameRow}>
                <p className={styles.recipeName}>{header.recipeName}</p>
                <Badge>{header.versionLabel}</Badge>
              </div>
              <div className={styles.chips}>
                {header.changes.map((c) => (
                  <Badge key={c} tone="changed" icon={Pencil}>
                    {`Changed: ${c}`}
                  </Badge>
                ))}
              </div>
              {header.note ? <p className={styles.note}>{header.note}</p> : null}
              {setupExtra}
              <TextField
                id={brewFieldId('brewedAt')}
                label="Brewed at"
                isRequired
                value={brewedText}
                onChange={(text) => {
                  setBrewedText(text);
                  set('brewedAt', fromLocalInput(text));
                }}
                isInvalid={Boolean(errorOf('brewedAt'))}
                errorMessage={errorOf('brewedAt')}
                inputProps={{ type: 'datetime-local', max: nowLocal }}
              />
              <TastedAt temp={form.tastedTemp} onTempChange={(v) => set('tastedTemp', v)} />
            </section>

            <section aria-labelledby="brew-results" className={cards.card}>
              <h2 id="brew-results" className={cards.cardTitle}>
                Results
              </h2>
              <div className={styles.grid}>
                {context.showDrawdown ? (
                  <div className={styles.withNote}>
                    <DurationField
                      id={brewFieldId('drawdownS')}
                      label="Drawdown"
                      value={form.drawdownS}
                      onChange={(v) => set('drawdownS', v)}
                      maxSeconds={BREW_LIMITS.drawdownMaxS}
                      errorMessage={errorOf('drawdownS')}
                    />
                    <TargetNote status={model.drawdownStatus} range={targetText.drawdown} />
                  </div>
                ) : null}
                <WeightField
                  id={brewFieldId('beverageG')}
                  label="Beverage weight"
                  description="Before bypass"
                  min={0}
                  value={form.beverageG}
                  onChange={(v) => set('beverageG', v)}
                  isInvalid={Boolean(errorOf('beverageG'))}
                  errorMessage={errorOf('beverageG')}
                />
                <div className={styles.withNote}>
                  <TypedNumberField
                    id={brewFieldId('tdsPct')}
                    label="TDS (%)"
                    description="e.g. 1.38"
                    value={form.tdsPct}
                    typed={typed.tdsPct}
                    error={errorOf('tdsPct')}
                    onChange={(v, text) => {
                      set('tdsPct', v);
                      setTypedText('tdsPct', text);
                    }}
                  />
                  <TargetNote status={model.tdsStatus} range={targetText.tds} />
                </div>
              </div>
              <ExtractionPanel model={model} />
            </section>

            <section aria-labelledby="brew-sensory" className={`${cards.card} ${cards.full}`}>
              <h2 id="brew-sensory" className={cards.cardTitle}>
                Sensory
              </h2>
              <div className={styles.sensory}>
                <div className={styles.sliders}>
                  {ATTRIBUTE_KEYS.map((key) => (
                    <Slider
                      key={key}
                      label={TASTE_LABELS[key]}
                      value={form[key]}
                      onChange={(v) => set(key, v)}
                    />
                  ))}
                  <OverallSlider
                    id={brewFieldId('overall')}
                    label="Overall"
                    value={form.overall}
                    onChange={(v) => set('overall', v)}
                    isInvalid={Boolean(errorOf('overall'))}
                    errorMessage={errorOf('overall')}
                  />
                </div>
                <div className={styles.radar}>
                  <p className={styles.overallBig} data-testid="overall-score">
                    <span className={styles.overallValue}>{overallText}</span>
                    {form.overall == null ? null : <span className={styles.overallOf}> / 10</span>}
                  </p>
                  <LazyTasteRadar
                    series={[{ key: 'brew', name: 'This brew', values: scores, overall: form.overall }]}
                  />
                </div>
              </div>
            </section>

            <>
              <section aria-labelledby="brew-flavours" className={cards.card}>
                <h2 id="brew-flavours" className={cards.cardTitle}>
                  Flavour notes
                </h2>
                <FlavourPicker
                  value={form.flavours}
                  recent={recent.data ?? []}
                  onChange={(tags) => set('flavours', tags)}
                />
                {errorOf('flavours') ? <p className={styles.hintError}>{errorOf('flavours')}</p> : null}
              </section>

              <section aria-labelledby="brew-notes" className={cards.card}>
                <h2 id="brew-notes" className={cards.cardTitle}>
                  Notes
                </h2>
                <Textarea
                  id={brewFieldId('notes')}
                  label="Notes"
                  rows={3}
                  maxLength={BREW_LIMITS.notesMax}
                  value={form.notes}
                  onChange={(v) => set('notes', v)}
                  isInvalid={Boolean(errorOf('notes'))}
                  errorMessage={errorOf('notes')}
                />
                <p className={styles.counter} aria-live="polite">
                  {form.notes.length} / {BREW_LIMITS.notesMax}
                </p>
                <Textarea
                  id={brewFieldId('nextChange')}
                  label="Next time I’ll change…"
                  rows={3}
                  maxLength={BREW_LIMITS.nextChangeMax}
                  value={form.nextChange}
                  onChange={(v) => set('nextChange', v)}
                  isInvalid={Boolean(errorOf('nextChange'))}
                  errorMessage={errorOf('nextChange')}
                />
                <p className={styles.counter} aria-live="polite">
                  {form.nextChange.length} / {BREW_LIMITS.nextChangeMax}
                </p>
              </section>
            </>
          </div>

          <div className={styles.footer}>
            <Button type="submit" isPending={isSaving} pendingLabel="Saving…">
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
