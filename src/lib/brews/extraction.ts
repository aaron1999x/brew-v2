import { brewRatio, extractionYield, overallRatio } from '@/lib/recipes/calc';
import { evaluateTarget, type TargetStatus } from './targets';

/** The targets a brew is read against: the version's, any of them can be missing. */
export type BrewTargets = {
  tdsMin: number | null;
  tdsMax: number | null;
  eyMin: number | null;
  eyMax: number | null;
  drawdownMinS: number | null;
  drawdownMaxS: number | null;
};

export const NO_TARGETS: BrewTargets = {
  tdsMin: null,
  tdsMax: null,
  eyMin: null,
  eyMax: null,
  drawdownMinS: null,
  drawdownMaxS: null,
};

export type ExtractionModel = {
  ratio: number | null;
  overall: number | null;
  /** Whether there is bypass, so the overall ratio is worth its own cell. */
  hasBypass: boolean;
  ey: number | null;
  tds: number | null;
  drawdownS: number | null;
  tdsStatus: TargetStatus | null;
  eyStatus: TargetStatus | null;
  drawdownStatus: TargetStatus | null;
  targets: BrewTargets;
};

/**
 * What the extraction panel shows: the ratios of the dose and water this brew used, extraction yield
 * (TDS × beverage ÷ dose, once both are filled in), and TDS, EY and drawdown against the version's
 * targets. `storedEy` is the database's own figure, preferred on a saved brew.
 */
export function extractionModel(input: {
  doseG: number | null;
  brewWaterG: number | null;
  bypassG: number | null;
  tdsPct: number | null;
  beverageG: number | null;
  drawdownS: number | null;
  targets: BrewTargets;
  storedEy?: number | null;
}): ExtractionModel {
  const ey = input.storedEy ?? extractionYield(input.tdsPct, input.beverageG, input.doseG);
  const bypass = input.bypassG ?? 0;
  const ratio = brewRatio(input.doseG, input.brewWaterG);
  const overall = overallRatio(input.doseG, input.brewWaterG, bypass);
  return {
    ratio,
    overall,
    hasBypass: bypass > 0,
    ey,
    tds: input.tdsPct,
    drawdownS: input.drawdownS,
    tdsStatus: evaluateTarget(input.tdsPct, input.targets.tdsMin, input.targets.tdsMax),
    eyStatus: evaluateTarget(ey, input.targets.eyMin, input.targets.eyMax),
    drawdownStatus: evaluateTarget(input.drawdownS, input.targets.drawdownMinS, input.targets.drawdownMaxS),
    targets: input.targets,
  };
}
