import { createHash } from 'node:crypto';
import {
  SENATE_PRINT_MINUTE_INTAKE_BUNDLE_SCHEMA,
  type SenatePrintMinuteIntakeBundle,
  type SenatePrintMinuteIntakeDocument,
} from './historical-density-2021-senate-print-minute-intake.js';

export const SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_MANIFEST_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-manifest-v1' as const;
export const SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_BUNDLE_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-bundle-v1' as const;

export const SENATE_PRINT_MINUTE_NON_DIRECTIONAL_REASONS = [
  'no_candidate_bill_mention',
  'bill_mention_without_named_member_position',
  'member_action_without_explicit_position',
  'administrative_or_procedural_only',
  'insufficient_legibility',
  'other_fail_closed',
] as const;

export type SenatePrintMinuteNonDirectionalReason =
  (typeof SENATE_PRINT_MINUTE_NON_DIRECTIONAL_REASONS)[number];
export type SenatePrintMinuteReviewDecision =
  | 'directional_claims'
  | 'no_directional_claims';
export type SenatePrintMinuteDirectionalStance = 'supports' | 'opposes';
export type SenatePrintMinuteDirectionalClaimType =
  | 'quoted_position'
  | 'explicit_position';
export type SenatePrintMinuteDirectionalExplicitness =
  | 'direct_quote'
  | 'attributed_paraphrase';

export interface SenatePrintMinuteSemanticClaimDecision {
  sourcePage: number;
  billIdentifier: string;
  memberName: string;
  attributedMemberText: string;
  stance: SenatePrintMinuteDirectionalStance;
  claimType: SenatePrintMinuteDirectionalClaimType;
  explicitness: SenatePrintMinuteDirectionalExplicitness;
  scope: 'whole_bill';
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
  transcriptionVerifiedAgainstSourcePage: true;
}

export interface SenatePrintMinuteDocumentReviewDecision {
  documentId: string;
  sourceContentSha256: string;
  fullDocumentReviewed: true;
  decision: SenatePrintMinuteReviewDecision;
  reasonCode?: SenatePrintMinuteNonDirectionalReason;
  notes: string[];
  claims: SenatePrintMinuteSemanticClaimDecision[];
}

export interface SenatePrintMinuteSemanticReviewManifest {
  schemaVersion: typeof SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_MANIFEST_SCHEMA;
  batchId: string;
  intakeBundleSha256: string;
  reviewedOn: string;
  reviewMethod: 'human_manual_full_document';
  reviews: SenatePrintMinuteDocumentReviewDecision[];
  policy: {
    outcomeUse: 'none';
    targetVoteOutcomesConsulted: false;
    partyOrIdeologyUsed: false;
    committeeMembershipUsedAsStance: false;
    attendanceUsedAsStance: false;
    proceduralActionUsedAsDirectionalStance: false;
    exactBillMentionRequired: true;
    explicitNamedMemberAttributionRequired: true;
    wholeBillPositionRequired: true;
  };
}

export interface SenatePrintMinuteSemanticClaim {
  semanticClaimId: string;
  semanticClaimFingerprintSha256: string;
  sourceDocumentId: string;
  sourceContentSha256: string;
  sourcePage: number;
  committeeEventId: string;
  committeeName: string;
  documentDate: string;
  billIdentifier: string;
  billId: string;
  candidateTargetEventIds: string[];
  candidateTargetDates: string[];
  memberName: string;
  attributedMemberText: string;
  publicIdentityResolved: false;
  internalMembershipIdentityResolved: false;
  linkage: 'exact_member_bill';
  specificity: 'exact_bill';
  stance: SenatePrintMinuteDirectionalStance;
  claimType: SenatePrintMinuteDirectionalClaimType;
  explicitness: SenatePrintMinuteDirectionalExplicitness;
  attributionType: 'official_record';
  attributedActor: string;
  scope: 'whole_bill';
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
  contextOnly: true;
  mechanicallyActionable: false;
  modelWeight: 0;
}

export interface SenatePrintMinuteSemanticReviewBundle {
  schemaVersion: typeof SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_BUNDLE_SCHEMA;
  generatedAt: string;
  batchId: string;
  intakeBundleSha256: string;
  summary: {
    documentsReviewed: number;
    directionalDocuments: number;
    nonDirectionalDocuments: number;
    semanticClaims: number;
    candidateTargetEvents: number;
    candidateBills: number;
    memberIdentitiesResolved: number;
  };
  documentReviews: Array<{
    documentId: string;
    sourceContentSha256: string;
    decision: SenatePrintMinuteReviewDecision;
    reasonCode: SenatePrintMinuteNonDirectionalReason | null;
    fullDocumentReviewed: true;
    claimCount: number;
    notes: string[];
  }>;
  semanticClaims: SenatePrintMinuteSemanticClaim[];
  documentReviewProofSha256: string;
  semanticClaimProofSha256: string;
  reviewProofSha256: string;
  policy: {
    outcomeUse: 'none';
    targetVoteOutcomesConsulted: false;
    partyOrIdeologyUsed: false;
    committeeMembershipUsedAsStance: false;
    attendanceUsedAsStance: false;
    proceduralActionUsedAsDirectionalStance: false;
    exactBillMentionRequired: true;
    explicitNamedMemberAttributionRequired: true;
    wholeBillPositionRequired: true;
    billApplicabilityRestrictedToIntakeCandidates: true;
    publicIdentityResolved: false;
    internalMembershipIdentityResolved: false;
    internalIdentityRequiredBeforeFeatureIntegration: true;
    contextOnly: true;
    mechanicallyActionable: false;
    modelWeight: 0;
    productionDatabaseQueried: false;
    productionWrites: false;
    featureRowsWritten: false;
    modelFitting: 'none';
    servingChanged: false;
    vercelUsed: false;
  };
}

const REQUEST_ARTIFACT_ID = 11496898656;
const REQUEST_ARTIFACT_DIGEST =
  'sha256:c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e';
const REQUEST_SOURCE_COMMIT_SHA =
  '39360a45fa9f8856e26001e4b005246c51467bcf';
const REQUEST_ASSOCIATION_PROOF =
  '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function setSha(values: readonly string[]): string {
  return sha256([...values].sort().join('\n') + '\n');
}
function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
function normalized(value: string): string {
  return compact(value).toLowerCase();
}
function dateOnly(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a valid date`);
  }
  return value;
}
function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
function escapeRegex(value: string): string {
  const specials = new Set(['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}']);
  return [...value].map((character) => specials.has(character) ? '\\' + character : character).join('');
}
function meaningfulSurname(memberName: string): string {
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
  const tokens = compact(memberName).split(' ').filter(Boolean);
  while (tokens.length > 1 && suffixes.has(tokens[tokens.length - 1]!.toLowerCase())) {
    tokens.pop();
  }
  return tokens.at(-1) ?? '';
}

function validateIntakeBundle(bundle: SenatePrintMinuteIntakeBundle): void {
  if (
    bundle.schemaVersion !== SENATE_PRINT_MINUTE_INTAKE_BUNDLE_SCHEMA
    || bundle.requestPackage.artifactId !== REQUEST_ARTIFACT_ID
    || bundle.requestPackage.artifactDigest !== REQUEST_ARTIFACT_DIGEST
    || bundle.requestPackage.sourceCommitSha !== REQUEST_SOURCE_COMMIT_SHA
    || bundle.requestPackage.requestAssociationProofSha256 !== REQUEST_ASSOCIATION_PROOF
    || bundle.policy.productionDatabaseQueried !== false
    || bundle.policy.productionWrites !== false
    || bundle.policy.targetVoteOutcomesRead !== false
    || bundle.policy.outcomeUse !== 'none'
    || bundle.policy.documentDateMustBeStrictPreVote !== true
    || bundle.policy.committeeAndDateMatchCreatesCandidateOnly !== true
    || bundle.policy.billMentionRequiredBeforeSemanticApplicability !== true
    || bundle.policy.memberAttributionRequiredBeforeDirectionalEvidence !== true
    || bundle.policy.returnedMinuteAutomaticallyEvidence !== false
    || bundle.policy.featureRowsWritten !== false
    || bundle.policy.modelFitting !== 'none'
    || bundle.policy.servingChanged !== false
    || bundle.policy.vercelUsed !== false
  ) {
    throw new Error('Senate print-minute intake bundle identity/policy drifted');
  }
  const ids = new Set<string>();
  for (const document of bundle.documents) {
    if (
      ids.has(document.id)
      || !isSha256(document.contentSha256)
      || document.semanticStatus !== 'unreviewed'
      || document.evidenceStatus !== 'not_evidence'
      || document.mechanicallyActionable !== false
      || document.modelWeight !== 0
      || document.candidateTargets.length === 0
    ) {
      throw new Error(`Unsafe intake document: ${document.id}`);
    }
    ids.add(document.id);
  }
}

function validateManifestPolicy(
  manifest: SenatePrintMinuteSemanticReviewManifest,
): void {
  if (
    manifest.schemaVersion !== SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_MANIFEST_SCHEMA
    || !manifest.batchId.trim()
    || !isSha256(manifest.intakeBundleSha256)
    || dateOnly(manifest.reviewedOn, 'reviewedOn') !== manifest.reviewedOn
    || manifest.reviewMethod !== 'human_manual_full_document'
    || manifest.policy.outcomeUse !== 'none'
    || manifest.policy.targetVoteOutcomesConsulted !== false
    || manifest.policy.partyOrIdeologyUsed !== false
    || manifest.policy.committeeMembershipUsedAsStance !== false
    || manifest.policy.attendanceUsedAsStance !== false
    || manifest.policy.proceduralActionUsedAsDirectionalStance !== false
    || manifest.policy.exactBillMentionRequired !== true
    || manifest.policy.explicitNamedMemberAttributionRequired !== true
    || manifest.policy.wholeBillPositionRequired !== true
  ) {
    throw new Error('Senate print-minute semantic-review manifest policy drifted');
  }
}

function validateClaim(
  document: SenatePrintMinuteIntakeDocument,
  claim: SenatePrintMinuteSemanticClaimDecision,
): SenatePrintMinuteSemanticClaim {
  if (
    !Number.isInteger(claim.sourcePage)
    || claim.sourcePage <= 0
    || (document.pageCount !== null && claim.sourcePage > document.pageCount)
  ) {
    throw new Error(`Invalid sourcePage for ${document.id}`);
  }
  if (!document.candidateBillIdentifiers.includes(claim.billIdentifier)) {
    throw new Error(`Semantic claim returned non-candidate bill ${claim.billIdentifier}`);
  }
  const excerpt = compact(claim.supportingExcerpt);
  const normalizedClaim = compact(claim.normalizedClaim);
  const memberName = compact(claim.memberName);
  const attributedMemberText = compact(claim.attributedMemberText);
  if (
    !excerpt
    || excerpt.length > 500
    || !normalizedClaim
    || normalizedClaim.length > 500
    || !memberName
    || !attributedMemberText
    || claim.scope !== 'whole_bill'
    || claim.transcriptionVerifiedAgainstSourcePage !== true
    || !Number.isFinite(claim.extractionConfidence)
    || claim.extractionConfidence < 0
    || claim.extractionConfidence > 1
  ) {
    throw new Error(`Incomplete semantic claim for ${document.id}`);
  }
  if (
    !['supports', 'opposes'].includes(claim.stance)
    || !['quoted_position', 'explicit_position'].includes(claim.claimType)
    || !['direct_quote', 'attributed_paraphrase'].includes(claim.explicitness)
    || (claim.claimType === 'quoted_position' && claim.explicitness !== 'direct_quote')
    || (claim.claimType === 'explicit_position' && claim.explicitness !== 'attributed_paraphrase')
  ) {
    throw new Error(`Unsupported directional semantics for ${document.id}`);
  }

  const billPattern = new RegExp(
    `(^|[^A-Z0-9])${escapeRegex(claim.billIdentifier.toUpperCase())}([^A-Z0-9]|$)`,
  );
  if (!billPattern.test(excerpt.toUpperCase())) {
    throw new Error(`Supporting excerpt does not contain exact bill identifier ${claim.billIdentifier}`);
  }
  if (!normalized(excerpt).includes(normalized(attributedMemberText))) {
    throw new Error('Supporting excerpt does not contain attributedMemberText');
  }
  const surname = meaningfulSurname(memberName);
  if (!surname || !normalized(attributedMemberText).includes(normalized(surname))) {
    throw new Error('attributedMemberText does not ground the reviewed member name');
  }

  const candidateTargets = document.candidateTargets.filter(
    (target) => target.identifier.toUpperCase() === claim.billIdentifier.toUpperCase(),
  );
  if (candidateTargets.length === 0) {
    throw new Error(`No intake candidate events remain for ${claim.billIdentifier}`);
  }
  const billIds = [...new Set(candidateTargets.map((target) => target.billId))];
  if (billIds.length !== 1) {
    throw new Error(`Candidate bill identity is ambiguous for ${claim.billIdentifier}`);
  }

  const fingerprintPayload = {
    sourceDocumentId: document.id,
    sourceContentSha256: document.contentSha256,
    sourcePage: claim.sourcePage,
    billIdentifier: claim.billIdentifier.toUpperCase(),
    billId: billIds[0],
    memberName,
    attributedMemberText,
    stance: claim.stance,
    claimType: claim.claimType,
    explicitness: claim.explicitness,
    scope: claim.scope,
    normalizedClaim,
    supportingExcerpt: excerpt,
    candidateTargetEventIds: candidateTargets.map((target) => target.voteEventId).sort(),
  };
  const semanticClaimFingerprintSha256 = sha256(JSON.stringify(fingerprintPayload));

  return {
    semanticClaimId: `senate-print-minute-claim-${semanticClaimFingerprintSha256.slice(0, 20)}`,
    semanticClaimFingerprintSha256,
    sourceDocumentId: document.id,
    sourceContentSha256: document.contentSha256,
    sourcePage: claim.sourcePage,
    committeeEventId: document.committeeEventId,
    committeeName: document.committeeName,
    documentDate: document.documentDate,
    billIdentifier: claim.billIdentifier.toUpperCase(),
    billId: billIds[0]!,
    candidateTargetEventIds: candidateTargets.map((target) => target.voteEventId).sort(),
    candidateTargetDates: candidateTargets.map((target) => target.targetVoteDate).sort(),
    memberName,
    attributedMemberText,
    publicIdentityResolved: false,
    internalMembershipIdentityResolved: false,
    linkage: 'exact_member_bill',
    specificity: 'exact_bill',
    stance: claim.stance,
    claimType: claim.claimType,
    explicitness: claim.explicitness,
    attributionType: 'official_record',
    attributedActor: memberName,
    scope: 'whole_bill',
    normalizedClaim,
    supportingExcerpt: excerpt,
    extractionConfidence: claim.extractionConfidence,
    contextOnly: true,
    mechanicallyActionable: false,
    modelWeight: 0,
  };
}

export function buildSenatePrintMinuteSemanticReviewBundle(input: {
  intakeBundle: SenatePrintMinuteIntakeBundle;
  intakeBundleSha256: string;
  manifest: SenatePrintMinuteSemanticReviewManifest;
  generatedAt?: string;
}): SenatePrintMinuteSemanticReviewBundle {
  validateIntakeBundle(input.intakeBundle);
  validateManifestPolicy(input.manifest);
  if (!isSha256(input.intakeBundleSha256)
    || input.manifest.intakeBundleSha256 !== input.intakeBundleSha256) {
    throw new Error('Semantic-review manifest intake bundle SHA-256 mismatch');
  }

  const documentById = new Map(
    input.intakeBundle.documents.map((document) => [document.id, document] as const),
  );
  if (input.manifest.reviews.length !== documentById.size) {
    throw new Error('Semantic-review manifest must review every intake document exactly once');
  }

  const reviewedIds = new Set<string>();
  const documentReviews: SenatePrintMinuteSemanticReviewBundle['documentReviews'] = [];
  const semanticClaims: SenatePrintMinuteSemanticClaim[] = [];

  for (const review of input.manifest.reviews) {
    const document = documentById.get(review.documentId);
    if (
      !document
      || reviewedIds.has(review.documentId)
      || review.sourceContentSha256 !== document.contentSha256
      || review.fullDocumentReviewed !== true
      || !Array.isArray(review.notes)
    ) {
      throw new Error(`Invalid semantic document review ${review.documentId}`);
    }
    reviewedIds.add(review.documentId);

    if (review.decision === 'no_directional_claims') {
      if (
        !review.reasonCode
        || !SENATE_PRINT_MINUTE_NON_DIRECTIONAL_REASONS.includes(review.reasonCode)
        || review.claims.length !== 0
      ) {
        throw new Error(`Non-directional review lacks fail-closed reason: ${review.documentId}`);
      }
      documentReviews.push({
        documentId: document.id,
        sourceContentSha256: document.contentSha256,
        decision: review.decision,
        reasonCode: review.reasonCode,
        fullDocumentReviewed: true,
        claimCount: 0,
        notes: [...review.notes],
      });
      continue;
    }

    if (
      review.decision !== 'directional_claims'
      || review.reasonCode !== undefined
      || review.claims.length < 1
      || review.claims.length > 16
    ) {
      throw new Error(`Invalid directional review ${review.documentId}`);
    }

    const claims = review.claims.map((claim) => validateClaim(document, claim));
    const fingerprints = claims.map((claim) => claim.semanticClaimFingerprintSha256);
    if (new Set(fingerprints).size !== fingerprints.length) {
      throw new Error(`Duplicate semantic claims in ${review.documentId}`);
    }
    semanticClaims.push(...claims);
    documentReviews.push({
      documentId: document.id,
      sourceContentSha256: document.contentSha256,
      decision: review.decision,
      reasonCode: null,
      fullDocumentReviewed: true,
      claimCount: claims.length,
      notes: [...review.notes],
    });
  }

  if (reviewedIds.size !== documentById.size) {
    throw new Error('Semantic-review document coverage drifted');
  }

  documentReviews.sort((a, b) => a.documentId.localeCompare(b.documentId));
  semanticClaims.sort((a, b) =>
    a.sourceDocumentId.localeCompare(b.sourceDocumentId)
    || a.billIdentifier.localeCompare(b.billIdentifier)
    || a.memberName.localeCompare(b.memberName)
    || a.semanticClaimFingerprintSha256.localeCompare(b.semanticClaimFingerprintSha256));

  const documentReviewProofSha256 = setSha(
    documentReviews.map((review) => [
      review.documentId,
      review.sourceContentSha256,
      review.decision,
      review.reasonCode ?? '',
      review.claimCount,
      review.fullDocumentReviewed,
    ].join('|')),
  );
  const semanticClaimProofSha256 = setSha(
    semanticClaims.map((claim) => [
      claim.semanticClaimFingerprintSha256,
      claim.sourceDocumentId,
      claim.billIdentifier,
      claim.billId,
      claim.memberName,
      claim.stance,
      claim.candidateTargetEventIds.join(','),
    ].join('|')),
  );
  const candidateTargetEvents = new Set(
    semanticClaims.flatMap((claim) => claim.candidateTargetEventIds),
  );
  const candidateBills = new Set(semanticClaims.map((claim) => claim.billId));
  const summary = {
    documentsReviewed: documentReviews.length,
    directionalDocuments: documentReviews.filter(
      (review) => review.decision === 'directional_claims',
    ).length,
    nonDirectionalDocuments: documentReviews.filter(
      (review) => review.decision === 'no_directional_claims',
    ).length,
    semanticClaims: semanticClaims.length,
    candidateTargetEvents: candidateTargetEvents.size,
    candidateBills: candidateBills.size,
    memberIdentitiesResolved: 0,
  };

  const policy = {
    outcomeUse: 'none' as const,
    targetVoteOutcomesConsulted: false as const,
    partyOrIdeologyUsed: false as const,
    committeeMembershipUsedAsStance: false as const,
    attendanceUsedAsStance: false as const,
    proceduralActionUsedAsDirectionalStance: false as const,
    exactBillMentionRequired: true as const,
    explicitNamedMemberAttributionRequired: true as const,
    wholeBillPositionRequired: true as const,
    billApplicabilityRestrictedToIntakeCandidates: true as const,
    publicIdentityResolved: false as const,
    internalMembershipIdentityResolved: false as const,
    internalIdentityRequiredBeforeFeatureIntegration: true as const,
    contextOnly: true as const,
    mechanicallyActionable: false as const,
    modelWeight: 0 as const,
    productionDatabaseQueried: false as const,
    productionWrites: false as const,
    featureRowsWritten: false as const,
    modelFitting: 'none' as const,
    servingChanged: false as const,
    vercelUsed: false as const,
  };
  const reviewProofSha256 = sha256(JSON.stringify({
    batchId: input.manifest.batchId,
    intakeBundleSha256: input.intakeBundleSha256,
    reviewedOn: input.manifest.reviewedOn,
    summary,
    documentReviewProofSha256,
    semanticClaimProofSha256,
    policy,
  }));

  return {
    schemaVersion: SENATE_PRINT_MINUTE_SEMANTIC_REVIEW_BUNDLE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    batchId: input.manifest.batchId,
    intakeBundleSha256: input.intakeBundleSha256,
    summary,
    documentReviews,
    semanticClaims,
    documentReviewProofSha256,
    semanticClaimProofSha256,
    reviewProofSha256,
    policy,
  };
}
