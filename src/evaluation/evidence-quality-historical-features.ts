export const EVIDENCE_QUALITY_HISTORICAL_FEATURES = [
  'exactDirectionalAvailable',
  'exactSupportSignatures',
  'exactOpposeSignatures',
  'exactMixedSignatures',
  'exactDirectQuoteSupportSignatures',
  'exactDirectQuoteOpposeSignatures',
  'exactExplicitSupportSignatures',
  'exactExplicitOpposeSignatures',
  'exactSupportMaxConfidence',
  'exactOpposeMaxConfidence',
  'exactMixedMaxConfidence',
  'exactDirectionalConflict',
] as const;

export type EvidenceQualityHistoricalFeatureName =
  (typeof EVIDENCE_QUALITY_HISTORICAL_FEATURES)[number];

export interface EvidenceQualityExactSignal {
  fingerprint: string;
  membershipId: string;
  billId: string;
  availableOn: string | null;
  supports: boolean;
  opposes: boolean;
  mixed: boolean;
  directQuoteSupport: boolean;
  directQuoteOppose: boolean;
  explicitSupport: boolean;
  explicitOppose: boolean;
  supportConfidence: number;
  opposeConfidence: number;
  mixedConfidence: number;
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function evidenceQualityFeaturesAsOf(
  signals: readonly EvidenceQualityExactSignal[],
  cutoffDateExclusive: string,
): number[] {
  if (!validDateOnly(cutoffDateExclusive)) {
    throw new Error('cutoffDateExclusive must be a valid YYYY-MM-DD date');
  }

  const byFingerprint = new Map<string, EvidenceQualityExactSignal>();
  for (const signal of signals) {
    if (!validDateOnly(signal.availableOn) || signal.availableOn >= cutoffDateExclusive) continue;
    const current = byFingerprint.get(signal.fingerprint);
    if (!current || (current.availableOn ?? '9999-99-99') > signal.availableOn) {
      byFingerprint.set(signal.fingerprint, signal);
    }
  }

  const eligible = [...byFingerprint.values()];
  const support = eligible.filter((signal) => signal.supports);
  const oppose = eligible.filter((signal) => signal.opposes);
  const mixed = eligible.filter((signal) => signal.mixed);
  const max = (values: readonly number[]) => values.length ? Math.max(...values) : 0;

  return [
    eligible.length > 0 ? 1 : 0,
    support.length,
    oppose.length,
    mixed.length,
    eligible.filter((signal) => signal.directQuoteSupport).length,
    eligible.filter((signal) => signal.directQuoteOppose).length,
    eligible.filter((signal) => signal.explicitSupport).length,
    eligible.filter((signal) => signal.explicitOppose).length,
    max(support.map((signal) => signal.supportConfidence)),
    max(oppose.map((signal) => signal.opposeConfidence)),
    max(mixed.map((signal) => signal.mixedConfidence)),
    support.length > 0 && oppose.length > 0 ? 1 : 0,
  ];
}
