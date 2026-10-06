export type P2ApplicabilityReviewDecision = 'applicable' | 'not_applicable';
export type P2ApplicabilityAlignment = 'aligns_with_bill' | 'conflicts_with_bill' | 'not_applicable';

export interface P2ApplicabilityCandidateReviewInput {
  claimId: string;
  identifier: string;
  versionSha256: string;
}

export interface P2ApplicabilityReviewResult {
  decision: P2ApplicabilityReviewDecision;
  alignment: P2ApplicabilityAlignment;
  billPolicyDirection: string;
  rationale: string;
  reviewConfidence: 'high' | 'medium';
}

type AcceptedReview = P2ApplicabilityCandidateReviewInput & P2ApplicabilityReviewResult;

export const P2_APPLICABILITY_ACCEPTED_REVIEWS: readonly AcceptedReview[] = [
  {
    claimId: 'p2-school-choice-parental-control',
    identifier: 'SF2575',
    versionSha256: '83db51b7fa5e3a6353e230e1ed06f53a575dea3799b84e1db96c98e212ab4b08',
    decision: 'applicable',
    alignment: 'aligns_with_bill',
    billPolicyDirection: 'strengthens_parental_curriculum_review_and_direct_parent_notification',
    rationale: 'Single-topic bill directly expands parental curriculum-review access and requires direct annual notice to parents, matching the frozen explicit support for parental control in education.',
    reviewConfidence: 'high',
  },
  {
    claimId: 'p2-coleman-gas-tax',
    identifier: 'HF1684',
    versionSha256: '222b9105fc5a808db561b3f5b7dc59bc5b993199b3e73adeccbe55b358737c4a',
    decision: 'applicable',
    alignment: 'conflicts_with_bill',
    billPolicyDirection: 'indexes_gasoline_excise_tax_upward_with_highway_construction_cost_inflation',
    rationale: 'The strict pre-vote transportation-finance text explicitly adds annual upward indexing to the gasoline excise tax and prevents the indexed rate from falling below the statutory floor. The frozen member claim explicitly opposes a gas-tax increase. Although the bill is omnibus, the tax-rate mechanism is explicit, material transportation-finance policy rather than an incidental reference.',
    reviewConfidence: 'medium',
  },
  {
    claimId: 'p2-jasinski-long-term-care-protections',
    identifier: 'SF443',
    versionSha256: '811a8a8dcfa61c7b68f81ba9669e3c0b47d8e20acef95fb034055f12b4ff9652',
    decision: 'applicable',
    alignment: 'aligns_with_bill',
    billPolicyDirection: 'extends_predatory_offender_disclosure_and_notice_requirements_to_hospice_providers',
    rationale: 'Single-topic bill extends an existing health-care-facility safety disclosure regime to hospice providers, directly strengthening protections in an elder/vulnerable-adult care setting and matching the frozen explicit support for stronger protections for seniors and vulnerable adults in long-term care.',
    reviewConfidence: 'high',
  },
] as const;

const ACCEPTED = new Map(
  P2_APPLICABILITY_ACCEPTED_REVIEWS.map((review) => [
    `${review.claimId}|${review.identifier}|${review.versionSha256}`,
    review,
  ]),
);

const REJECTION_REASON_BY_CLAIM: Readonly<Record<string, string>> = {
  'p2-school-choice-parental-control':
    'Candidate wording does not establish a sufficiently specific whole-bill school-choice/parental-control policy match under the conservative rule; incidental references and broad education omnibus provisions fail closed.',
  'p2-coleman-gas-tax':
    'Candidate wording does not establish a gasoline-excise-tax increase policy; International Fuel Tax Agreement references and technical fuel-tax references are not the member claim.',
  'p2-murphy-minnesotacare-for-all':
    'MinnesotaCare is referenced, administered, funded, or used as an eligibility category, but the bill does not establish the frozen claim-specific policy of making MinnesotaCare broadly available to all Minnesotans.',
  'p2-port-minnesotacare-for-all':
    'MinnesotaCare is referenced, administered, funded, or used as an eligibility category, but the bill does not establish the frozen claim-specific policy of creating a path to MinnesotaCare for All.',
  'p2-koran-pro-life':
    'Abortion, fetal, unborn-child, pregnancy, or reproductive-health wording is incidental, definitional, existing-law context, or part of a broader bill; the candidate does not establish a direct whole-bill abortion-policy change that can safely map to the frozen pro-life claim.',
  'p2-jasinski-long-term-care-protections':
    'Long-term-care, nursing-facility, assisted-living, or vulnerable-adult wording does not by itself establish the frozen claim-specific policy of stronger protections for seniors/vulnerable adults; insurance, staffing, consultation, rate, technical, and broad omnibus references fail closed.',
};

export function reviewP2ApplicabilityCandidate(input: P2ApplicabilityCandidateReviewInput): P2ApplicabilityReviewResult {
  const key = `${input.claimId}|${input.identifier}|${input.versionSha256}`;
  const accepted = ACCEPTED.get(key);
  if (accepted) {
    return {
      decision: accepted.decision,
      alignment: accepted.alignment,
      billPolicyDirection: accepted.billPolicyDirection,
      rationale: accepted.rationale,
      reviewConfidence: accepted.reviewConfidence,
    };
  }
  const rationale = REJECTION_REASON_BY_CLAIM[input.claimId];
  if (!rationale) throw new Error(`Unknown P2 applicability claim id: ${input.claimId}`);
  return {
    decision: 'not_applicable',
    alignment: 'not_applicable',
    billPolicyDirection: 'not_inferred',
    rationale,
    reviewConfidence: 'high',
  };
}
