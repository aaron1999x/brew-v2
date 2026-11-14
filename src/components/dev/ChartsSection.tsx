'use client';

import { useState } from 'react';
import { ExtractionScatter, type ExtractionPoint } from '@/components/charts/ExtractionScatter';
import { PourCurve, type PourStep } from '@/components/charts/PourCurve';
import { SensoryRadar } from '@/components/charts/SensoryRadar';
import { Slider } from '@/components/ui/Slider/Slider';
import styles from './sections.module.css';

const attributes = [
  'Sweetness',
  'Acidity',
  'Brightness',
  'Body',
  'Clarity',
  'Balance',
  'Aftertaste',
  'Overall',
] as const;

const brews = [
  { key: 'brew1', name: 'Sat 14 Nov · v3', values: [8, 7, 7.5, 6, 8.5, 7.5, 7, 8] },
  { key: 'brew2', name: 'Fri 13 Nov · v2', values: [6.5, 8, 8.5, 5, 7, 6, 6, 6.5] },
  { key: 'brew3', name: 'Thu 12 Nov · v2', values: [7, 5.5, 6, 7.5, 6.5, 8, 7.5, 7] },
];

const pourSteps: PourStep[] = [
  { type: 'pour', start: 0, end: 20, to: 50, label: 'Bloom' },
  { type: 'swirl', at: 25 },
  { type: 'pour', start: 45, end: 75, to: 150, label: 'Second pour' },
  { type: 'wait', at: 88 },
  { type: 'pour', start: 95, end: 125, to: 250, label: 'Final pour' },
  { type: 'swirl', at: 132 },
];

const extraction: ExtractionPoint[] = [
  { name: 'Nov 8', ey: 18.2, tds: 1.28 },
  { name: 'Nov 9', ey: 19.6, tds: 1.34 },
  { name: 'Nov 10', ey: 21.1, tds: 1.41 },
  { name: 'Nov 11', ey: 20.4, tds: 1.37 },
  { name: 'Nov 12', ey: 22.8, tds: 1.52 },
  { name: 'Nov 13', ey: 17.1, tds: 1.12 },
  { name: 'Nov 14', ey: 20.9, tds: 1.39 },
  { name: 'Nov 15', ey: 19.1, tds: 1.55 },
];

export function ChartsSection() {
  const [scores, setScores] = useState<number[]>(() => attributes.map(() => 6));

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Sensory sliders with live radar</h3>
        <p className={styles.result}>Drag a slider; the radar follows.</p>
        <div className={styles.sensory}>
          <div className={styles.stack}>
            {attributes.map((name, i) => (
              <Slider
                key={name}
                label={name}
                value={scores[i]}
                onChange={(v) => setScores((prev) => prev.map((s, j) => (j === i ? v : s)))}
              />
            ))}
          </div>
          <SensoryRadar
            title="Tasting radar"
            description="Eight tasting attributes scored out of 10, updating as you move the sliders."
            attributes={attributes}
            series={[{ key: 'now', name: 'This brew', values: scores }]}
          />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Compare three brews</h3>
        <SensoryRadar
          title="Brew comparison"
          description="Three brews compared on eight attributes; each has its own line style and marker."
          attributes={attributes}
          series={brews}
        />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Pour curve</h3>
        <PourCurve steps={pourSteps} targetDrawdown={{ from: 150, to: 180 }} duration={210} />
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>TDS vs extraction</h3>
        <ExtractionScatter points={extraction} target={{ ey: [18, 22], tds: [1.15, 1.45] }} />
      </div>
    </>
  );
}
