'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { Combobox, type ComboboxSelection } from '@/components/ui/Combobox/Combobox';
import { NumberField } from '@/components/ui/NumberField/NumberField';
import { RadioGroup } from '@/components/ui/RadioGroup/RadioGroup';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { Select } from '@/components/ui/Select/Select';
import { Slider } from '@/components/ui/Slider/Slider';
import { Switch } from '@/components/ui/Switch/Switch';
import { TextField } from '@/components/ui/TextField/TextField';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { TimeInput } from '@/components/ui/TimeInput/TimeInput';
import styles from './sections.module.css';

const methods = [
  { id: 'v60', label: 'Hario V60' },
  { id: 'aeropress', label: 'AeroPress' },
  { id: 'chemex', label: 'Chemex' },
  { id: 'kalita', label: 'Kalita Wave' },
  { id: 'french', label: 'French press' },
];

const gear = [
  { id: 'c40', label: 'Comandante C40 MK4' },
  { id: 'k-ultra', label: 'Kingrinder K6' },
  { id: 'timemore', label: 'Timemore Chestnut C3' },
  { id: 'fellow', label: 'Fellow Ode Gen 2' },
  { id: 'cafe', label: 'Café du Monde press' },
];

function describe(s: ComboboxSelection | null): string {
  if (!s) return 'Nothing chosen yet.';
  if (s.kind === 'item') return `Chose “${s.item.label}”.`;
  if (s.kind === 'custom') return `Using free text “${s.text}”.`;
  return 'Cleared.';
}

export function InputsSection() {
  const [dose, setDose] = useState<number>(18);
  const [seconds, setSeconds] = useState<number | null>(150);
  const [score, setScore] = useState(7.5);
  const [roast, setRoast] = useState('medium');
  const [picked, setPicked] = useState<ComboboxSelection | null>(null);
  const [custom, setCustom] = useState<ComboboxSelection | null>(null);

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Text, textarea, select</h3>
        <div className={styles.grid}>
          <TextField label="Recipe name" placeholder="Morning V60" />
          <TextField
            label="Recipe name"
            isRequired
            description="Shown on your recipe page."
            defaultValue="Washed Ethiopia"
          />
          <TextField
            label="Handle"
            isInvalid
            errorMessage="That handle isn't available. Try another."
            defaultValue="aaron"
          />
          <TextField label="Handle" isDisabled defaultValue="locked" />
          <Textarea
            label="Notes"
            description="Grows as you type."
            placeholder="Bloom looked uneven…"
          />
          <Textarea
            label="Notes"
            isInvalid
            errorMessage="Notes can be up to 2,000 characters."
            defaultValue="Too long"
          />
          <Select label="Method" options={methods} defaultSelectedKey="v60" />
          <Select
            label="Method"
            options={methods}
            isRequired
            description="Pick the closest match."
          />
          <Select label="Method" options={methods} isInvalid errorMessage="Choose a method." />
          <Select label="Method" options={methods} isDisabled defaultSelectedKey="chemex" />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Number with unit, time</h3>
        <div className={styles.grid}>
          <NumberField
            label="Coffee"
            unit="g"
            value={dose}
            onChange={setDose}
            minValue={1}
            maxValue={100}
            step={0.5}
            formatOptions={{ maximumFractionDigits: 1 }}
          />
          <NumberField
            label="Water"
            unit="ml"
            defaultValue={300}
            minValue={0}
            maxValue={2000}
            showStepper
            description="With − and + buttons."
          />
          <div className={styles.pair} data-testid="number-pair">
            <NumberField label="Coffee" unit="g" defaultValue={18} showStepper />
            <NumberField label="Water" unit="ml" defaultValue={300} showStepper />
          </div>
          <NumberField
            label="Water temperature"
            unit="°C"
            defaultValue={93}
            minValue={0}
            maxValue={100}
          />
          <NumberField label="Water temperature" unit="°F" defaultValue={199} />
          <NumberField label="Bloom" unit="s" defaultValue={30} />
          <NumberField
            label="Coffee"
            unit="g"
            isInvalid
            errorMessage="Enter 1 to 100 grams."
            defaultValue={0}
          />
          <NumberField label="Coffee" unit="g" isDisabled defaultValue={18} />
          <TimeInput
            label="Total time"
            value={seconds}
            onChange={setSeconds}
            description="Try 2:30, 230, 150s or 45."
          />
          <TimeInput label="Total time (disabled)" isDisabled value={95} />
        </div>
        <p className={styles.result}>
          Coffee: {dose} g · Time stored: {seconds ?? '–'} s
        </p>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Slider 0–10</h3>
        <div className={styles.stack}>
          <Slider label="Sweetness" value={score} onChange={setScore} />
          <Slider label="Acidity" defaultValue={3} />
          <Slider label="Body (disabled)" defaultValue={5} isDisabled />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Switch, checkbox, radio, segmented</h3>
        <div className={styles.grid}>
          <div className={styles.group}>
            <Switch>Make recipe public</Switch>
            <Switch defaultSelected>Remind me to log brews</Switch>
            <Switch isDisabled>Disabled off</Switch>
            <Switch isDisabled defaultSelected>
              Disabled on
            </Switch>
          </div>
          <div className={styles.group}>
            <Checkbox>I brewed this</Checkbox>
            <Checkbox defaultSelected>Include tasting notes</Checkbox>
            <Checkbox isIndeterminate>Some selected</Checkbox>
            <Checkbox isInvalid>Accept the terms</Checkbox>
            <Checkbox isDisabled>Disabled</Checkbox>
          </div>
          <RadioGroup
            label="Units"
            defaultValue="metric"
            options={[
              { value: 'metric', label: 'Metric (g, °C)' },
              { value: 'imperial', label: 'Imperial (oz, °F)' },
              { value: 'other', label: 'Disabled option', isDisabled: true },
            ]}
          />
          <RadioGroup
            label="Visibility"
            isInvalid
            errorMessage="Choose who can see this recipe."
            options={[
              { value: 'private', label: 'Private' },
              { value: 'public', label: 'Public' },
            ]}
          />
          <div className={styles.group}>
            <SegmentedControl
              label="Roast"
              value={roast}
              onChange={setRoast}
              segments={[
                { value: 'light', label: 'Light' },
                { value: 'medium', label: 'Medium' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <p className={styles.result}>Roast: {roast}</p>
            <SegmentedControl
              label="Temperature unit (disabled)"
              isDisabled
              defaultValue="c"
              segments={[
                { value: 'c', label: '°C' },
                { value: 'f', label: '°F' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Combobox</h3>
        <div className={styles.grid}>
          <div className={styles.group}>
            <Combobox
              label="Grinder"
              items={gear}
              placeholder="Search grinders"
              onSelect={setPicked}
            />
            <p className={styles.result} role="status">
              {describe(picked)}
            </p>
          </div>
          <div className={styles.group}>
            <Combobox
              label="Grinder (free text allowed)"
              items={gear}
              allowsCustomValue
              placeholder="Type any grinder"
              description="Not listed? Use what you typed."
              onSelect={setCustom}
            />
            <p className={styles.result} role="status">
              {describe(custom)}
            </p>
          </div>
          <Combobox label="Grinder (loading)" items={[]} isLoading placeholder="Search grinders" />
          <Combobox
            label="Grinder"
            items={gear}
            isInvalid
            errorMessage="Pick a grinder from the list."
          />
          <Combobox label="Grinder (disabled)" items={gear} isDisabled />
        </div>
      </div>
    </>
  );
}
