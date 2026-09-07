import type { EvidenceFreshness, EvidenceKind, EvidenceRelevance, EvidenceSignal, EvidenceSourceQuality, EvidenceStance } from './types';

export const EVIDENCE_IMPACT_VERSION = 'logit-evidence-v1';

export interface EvidenceImpactContribution {
  evidenceId?: string;
  logitDelta: number;
}

export interface EvidenceImpactResult {
  version: typeof EVIDENCE_IMPACT_VERSION;
  baseProbability: number;
  probability: number;
  totalLogitDelta: number;
  contributions: EvidenceImpactContribution[];
}

const KIND_WEIGHT: Record<EvidenceKind, number> = {
  direct_statement: 2.2,
  related_statement: 1.25,
  fact: 0.65,
  context: 0.35,
  inference: 0.25,
};
const QUALITY_WEIGHT: Record<EvidenceSourceQuality, number> = {
  official: 1,
  member_primary: 1,
  reputable_secondary: 0.8,
  other: 0.55,
  unknown: 0.35,
};
const RELEVANCE_WEIGHT: Record<EvidenceRelevance, number> = { direct: 1, high: 0.8, medium: 0.55, low: 0.3 };
const FRESHNESS_WEIGHT: Record<EvidenceFreshness, number> = { current: 1, recent: 0.85, stale: 0.45, unknown: 0.65 };
const STANCE_DIRECTION: Record<EvidenceStance, number> = { supports: 1, opposes: -1, mixed: 0, neutral: 0, unclear: 0 };

function clampProbability(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('probability must be between 0 and 1');
  return Math.min(0.995, Math.max(0.005, value));
}

function logit(probability: number): number {
  const bounded = clampProbability(probability);
  return Math.log(bounded / (1 - bounded));
}

function logistic(value: number): number {
  return clampProbability(1 / (1 + Math.exp(-value)));
}

export function evidenceLogitDelta(signal: EvidenceSignal): number {
  const confidence = signal.confidence === undefined ? 0.5 : signal.confidence;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('confidence must be between 0 and 1');
  return STANCE_DIRECTION[signal.stance]
    * KIND_WEIGHT[signal.kind]
    * QUALITY_WEIGHT[signal.sourceQuality]
    * RELEVANCE_WEIGHT[signal.relevance]
    * FRESHNESS_WEIGHT[signal.freshness]
    * confidence;
}

export function applyEvidenceSignals(baseProbability: number, signals: readonly EvidenceSignal[]): EvidenceImpactResult {
  const base = clampProbability(baseProbability);
  const contributions = signals.map((signal) => ({ evidenceId: signal.evidenceId, logitDelta: evidenceLogitDelta(signal) }));
  const totalLogitDelta = contributions.reduce((sum, contribution) => sum + contribution.logitDelta, 0);
  return {
    version: EVIDENCE_IMPACT_VERSION,
    baseProbability: base,
    probability: logistic(logit(base) + totalLogitDelta),
    totalLogitDelta,
    contributions,
  };
}
