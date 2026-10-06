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
