import {
  P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS,
  p2ApplicabilityReviewKey,
  type P2ApplicabilitySemanticReviewDecision,
} from './historical-density-p2-applicability-semantic-review.js';

export type CanonicalP2ApplicabilityDecision =
  | P2ApplicabilitySemanticReviewDecision
  | {
      decision: 'pending_review';
      reasonCode: 'unreviewed_candidate_group';
      billPolicyDirection: null;
      alignmentDirection: null;
    };

const DISPUTED_SF443_KEY = p2ApplicabilityReviewKey(
  'long_term_care_protections',
  'SF443',
  '2021-04-21',
);

export const P2_CANONICAL_DISPUTE_OVERRIDES: Readonly<
  Record<string, CanonicalP2ApplicabilityDecision>
> = Object.freeze({
  [DISPUTED_SF443_KEY]: {
    decision: 'ambiguous_fail_closed',
    reasonCode: 'cross_review_scope_disagreement_fail_closed',
    billPolicyDirection: null,
    alignmentDirection: null,
  },
});

export const P2_CANONICAL_APPLICABLE_KEYS = Object.freeze([
  p2ApplicabilityReviewKey('gas_tax', 'HF1684', '2021-04-22'),
  p2ApplicabilityReviewKey(
    'school_choice_parental_control',
    'SF2575',
    '2022-03-03',
  ),
] as const);

export function canonicalP2ApplicabilityDecision(
  reviewKey: string,
): CanonicalP2ApplicabilityDecision {
  const override = P2_CANONICAL_DISPUTE_OVERRIDES[reviewKey];
  if (override) return override;

  const reviewed = P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS[reviewKey];
  if (reviewed) return reviewed;

  return {
    decision: 'pending_review',
    reasonCode: 'unreviewed_candidate_group',
    billPolicyDirection: null,
    alignmentDirection: null,
  };
}

export const REVIEWED_APPLICABILITY_FEATURE_NAMES = [
  'reviewedApplicabilityDirectionalAvailable',
  'reviewedApplicabilitySupportSignatures',
  'reviewedApplicabilityOpposeSignatures',
  'reviewedApplicabilityMixedSignatures',
  'reviewedApplicabilityDirectQuoteSupportSignatures',
  'reviewedApplicabilityDirectQuoteOpposeSignatures',
  'reviewedApplicabilityExplicitSupportSignatures',
  'reviewedApplicabilityExplicitOpposeSignatures',
  'reviewedApplicabilitySupportMaxConfidence',
  'reviewedApplicabilityOpposeMaxConfidence',
  'reviewedApplicabilityMixedMaxConfidence',
  'reviewedApplicabilityDirectionalConflict',
] as const;

export type ReviewedApplicabilityFeatureName =
  (typeof REVIEWED_APPLICABILITY_FEATURE_NAMES)[number];

export interface ReviewedApplicabilityFeatureInput {
  alignmentDirection:
    | 'position_aligns_with_bill'
    | 'position_conflicts_with_bill';
  explicitness: 'direct_quote' | 'document_position' | 'attributed_paraphrase';
  extractionConfidence: number;
}

export function reviewedApplicabilityFeatureVector(
  input: ReviewedApplicabilityFeatureInput,
): number[] {
  if (
    !Number.isFinite(input.extractionConfidence)
    || input.extractionConfidence < 0
    || input.extractionConfidence > 1
  ) {
    throw new Error('extractionConfidence must be in [0,1]');
  }

  const supports = input.alignmentDirection === 'position_aligns_with_bill';
  const opposes = input.alignmentDirection === 'position_conflicts_with_bill';
  const directQuote = input.explicitness === 'direct_quote';

  return [
    1,
    supports ? 1 : 0,
    opposes ? 1 : 0,
    0,
    supports && directQuote ? 1 : 0,
    opposes && directQuote ? 1 : 0,
    supports && !directQuote ? 1 : 0,
    opposes && !directQuote ? 1 : 0,
    supports ? input.extractionConfidence : 0,
    opposes ? input.extractionConfidence : 0,
    0,
    0,
  ];
}

export const P2_ACCEPTED_CLAIM_FEATURE_METADATA = Object.freeze({
  'p2-school-choice-parental-control': {
    claimType: 'quoted_position',
    explicitness: 'direct_quote',
    extractionConfidence: 0.97,
  },
  'p2-coleman-gas-tax': {
    claimType: 'quoted_position',
    explicitness: 'direct_quote',
    extractionConfidence: 0.97,
  },
} as const);
