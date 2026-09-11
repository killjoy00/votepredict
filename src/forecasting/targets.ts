export const FORECAST_TARGET_KINDS = [
  'committee_hearing',
  'committee_passage',
  'calendar_placement',
  'source_chamber_passage',
  'house_floor_passage',
  'senate_floor_passage',
  'identical_text_adoption',
  'conference_report_adoption',
  'governor_signature',
  'enactment',
] as const;

export type ForecastTargetKind = typeof FORECAST_TARGET_KINDS[number];
export type ForecastCalibrationStatus = 'unvalidated' | 'experimental' | 'calibrated';

export interface ForecastTargetDefinition {
  kind: ForecastTargetKind;
  label: string;
  conditionalOn?: string;
  terminal: boolean;
}

const TARGETS: Record<ForecastTargetKind, ForecastTargetDefinition> = {
  committee_hearing: { kind: 'committee_hearing', label: 'Committee hearing', terminal: false },
  committee_passage: { kind: 'committee_passage', label: 'Committee passage', conditionalOn: 'a committee vote', terminal: false },
  calendar_placement: { kind: 'calendar_placement', label: 'Floor calendar placement', terminal: false },
  source_chamber_passage: { kind: 'source_chamber_passage', label: 'Originating-chamber passage', terminal: false },
  house_floor_passage: { kind: 'house_floor_passage', label: 'House floor passage', conditionalOn: 'a House floor vote', terminal: false },
  senate_floor_passage: { kind: 'senate_floor_passage', label: 'Senate floor passage', conditionalOn: 'a Senate floor vote', terminal: false },
  identical_text_adoption: { kind: 'identical_text_adoption', label: 'Identical-text adoption', conditionalOn: 'different versions passing the chambers', terminal: false },
  conference_report_adoption: { kind: 'conference_report_adoption', label: 'Conference-report adoption', conditionalOn: 'a conference report', terminal: false },
  governor_signature: { kind: 'governor_signature', label: 'Governor signature', conditionalOn: 'presentment', terminal: false },
  enactment: { kind: 'enactment', label: 'Enactment', terminal: true },
};

export function forecastTargetDefinition(kind: ForecastTargetKind): ForecastTargetDefinition {
  return TARGETS[kind];
}

export function floorTargetForChamber(chamberSlug: string): ForecastTargetKind {
  if (chamberSlug === 'house') return 'house_floor_passage';
  if (chamberSlug === 'senate') return 'senate_floor_passage';
  throw new Error(`Unsupported chamber for a floor-passage target: ${chamberSlug}`);
}

export function forecastProbabilityLabel(kind: ForecastTargetKind, calibration: ForecastCalibrationStatus): string {
  const target = forecastTargetDefinition(kind);
  const metric = calibration === 'calibrated' ? 'probability' : 'estimate';
  const conditioning = target.conditionalOn ? ` (conditional on ${target.conditionalOn})` : '';
  return `${target.label} ${metric}${conditioning}`;
}
