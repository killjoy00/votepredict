import { createHash } from 'node:crypto';
import {
  buildSenatePrintMinuteSemanticReviewBundle,
  type SenatePrintMinuteSemanticReviewBundle,
  type SenatePrintMinuteSemanticReviewManifest,
} from './historical-density-2021-senate-print-minute-semantic-review.js';
import type {
  SenatePrintMinuteIntakeBundle,
  SenatePrintMinuteIntakeDocument,
} from './historical-density-2021-senate-print-minute-intake.js';

export const SENATE_PRINT_MINUTE_REVIEW_PACKET_SCHEMA =
  'historical-density-2021-senate-print-minute-semantic-review-packet-v1' as const;
export const SENATE_PRINT_MINUTE_REVIEW_COMPLETION_TEMPLATE_SCHEMA =
  'historical-density-2021-senate-print-minute-review-completion-template-v1' as const;
export const SENATE_PRINT_MINUTE_REVIEW_COMPLETION_MANIFEST_SCHEMA =
  'historical-density-2021-senate-print-minute-review-completion-manifest-v1' as const;
export const SENATE_PRINT_MINUTE_REVIEW_FINALIZATION_SCHEMA =
  'historical-density-2021-senate-print-minute-review-finalization-v1' as const;

export const SENATE_PRINT_MINUTE_PACKET_DECISIONS = [
  'not_applicable_to_candidate_bill',
  'bill_context_only_no_member_direction',
  'directional_member_statement',
  'ambiguous_fail_closed',
] as const;

export type SenatePrintMinutePacketDecision =
  (typeof SENATE_PRINT_MINUTE_PACKET_DECISIONS)[number];

export interface SenatePrintMinuteReviewPacketRow {
  row: number;
  reviewKey: string;
  documentId: string;
  sourceContentSha256: string;
  archivedRelativePath: string;
  committeeEventId: string;
  committeeName: string;
  documentDate: string;
  sourceTitle: string;
  lrlReference: string | null;
  acquisitionMethod: string | null;
  candidateTarget: {
    voteEventId: string;
    billId: string;
    identifier: string;
    targetVoteDate: string;
    requestWindowStart: string;
    requestWindowEndExclusive: string;
    referralDates: string[];
  };
  review: Record<string, null>;
}

export interface SenatePrintMinuteReviewPacket {
  schemaVersion: typeof SENATE_PRINT_MINUTE_REVIEW_PACKET_SCHEMA;
  issue: number;
  sourceIntake: {
    requestPackageArtifactId: number;
    documents: number;
    sourceLedgerProofSha256: string;
    sourceContentSha256Set: string[];
  };
  summary: {
    reviewRows: number;
    documents: number;
    committees: number;
    candidateTargetEvents: number;
    candidateBills: number;
    completedDecisions: number;
  };
  reviewKeySha256: string;
  allowedDecisionValues: string[];
  requiredForDirectionalDecision: string[];
  rows: SenatePrintMinuteReviewPacketRow[];
  policy: Record<string, unknown>;
  reviewPacketProofSha256: string;
}

export interface SenatePrintMinuteReviewCompletionDecision {
  row: number;
  reviewKey: string;
  documentId: string;
  candidateBillIdentifier: string;
  candidateTargetEventId: string;
  decision: SenatePrintMinutePacketDecision | null;
  reasonCode: string | null;
  billMentionExcerpt: string | null;
  billMentionPage: number | null;
  memberName: string | null;
  attributedMemberText: string | null;
  memberStance: 'supports' | 'opposes' | null;
  claimType: 'quoted_position' | 'explicit_position' | null;
  explicitness: 'direct_quote' | 'attributed_paraphrase' | null;
  scope: 'whole_bill' | null;
  normalizedClaim: string | null;
  supportingExcerpt: string | null;
  supportingPage: number | null;
  extractionConfidence: number | null;
  transcriptionVerifiedAgainstSourcePage: true | null;
  notes: string[];
}

export interface SenatePrintMinuteReviewCompletionManifest {
  schemaVersion: typeof SENATE_PRINT_MINUTE_REVIEW_COMPLETION_MANIFEST_SCHEMA;
  batchId: string;
  intakeBundleSha256: string;
  reviewedOn: string;
  reviewMethod: 'human_manual_full_document';
  frozenReviewPacket: {
    reviewKeySha256: string;
    reviewPacketProofSha256: string;
    reviewRows: number;
    sourceLedgerProofSha256: string;
  };
  documentAttestations: Array<{
    documentId: string;
    sourceContentSha256: string;
    fullDocumentReviewed: boolean | null;
    notes: string[];
  }>;
  decisions: SenatePrintMinuteReviewCompletionDecision[];
  policy: {
    outcomeUse: 'none';
    targetVoteOutcomesConsulted: false;
    partyOrIdeologyUsed: false;
    committeeMembershipUsedAsStance: false;
    attendanceUsedAsStance: false;
    proceduralActionUsedAsDirectionalStance: false;
    packetRowsRequireExplicitDecision: true;
    fullDocumentReviewRequired: true;
    exactBillMentionRequiredForDirectional: true;
    explicitNamedMemberAttributionRequired: true;
    wholeBillPositionRequired: true;
  };
}

export interface SenatePrintMinuteReviewFinalization {
  schemaVersion: typeof SENATE_PRINT_MINUTE_REVIEW_FINALIZATION_SCHEMA;
  generatedAt: string;
  batchId: string;
  intakeBundleSha256: string;
  frozenReviewPacket: SenatePrintMinuteReviewCompletionManifest['frozenReviewPacket'];
  summary: {
    reviewRows: number;
    directionalRows: number;
    billContextRows: number;
    notApplicableRows: number;
    ambiguousRows: number;
    documentsReviewed: number;
    semanticClaims: number;
    candidateTargetEvents: number;
    candidateBills: number;
  };
  documentAttestations: SenatePrintMinuteReviewCompletionManifest['documentAttestations'];
  decisions: SenatePrintMinuteReviewCompletionDecision[];
  documentAttestationProofSha256: string;
  rowDecisionProofSha256: string;
  semanticReviewProofSha256: string;
  semanticReviewBundleSha256: string;
  policy: {
    outcomeUse: 'none';
    targetVoteOutcomesConsulted: false;
    packetRowsFullyAdjudicated: true;
    fullDocumentReviewAttested: true;
    nonDirectionalRowsPreservedInAudit: true;
    semanticClaimsValidatedByCanonicalReviewer: true;
    publicIdentityResolved: false;
    internalMembershipIdentityResolved: false;
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function setSha(values: readonly string[]): string {
  return sha256([...values].sort().join('\n') + '\n');
}
function isSha(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
function compact(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
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
function packetProof(packet: SenatePrintMinuteReviewPacket): string {
  return sha256(JSON.stringify({
    issue: packet.issue,
    sourceIntake: packet.sourceIntake,
    summary: packet.summary,
    reviewKeySha256: packet.reviewKeySha256,
    allowedDecisionValues: packet.allowedDecisionValues,
    requiredForDirectionalDecision: packet.requiredForDirectionalDecision,
    rows: packet.rows,
    policy: packet.policy,
  }));
}

export function validateSenatePrintMinuteReviewPacket(
  packet: SenatePrintMinuteReviewPacket,
): SenatePrintMinuteReviewPacket {
  const reviewKeys = packet.rows.map((row) => row.reviewKey);
  const documents = new Set(packet.rows.map((row) => row.documentId));
  const committees = new Set(packet.rows.map((row) => row.committeeEventId));
  const events = new Set(packet.rows.map((row) => row.candidateTarget.voteEventId));
  const bills = new Set(packet.rows.map((row) => row.candidateTarget.billId));
  if (
    packet.schemaVersion !== SENATE_PRINT_MINUTE_REVIEW_PACKET_SCHEMA
    || packet.issue !== 718
    || packet.sourceIntake.requestPackageArtifactId !== 11496898656
    || !isSha(packet.sourceIntake.sourceLedgerProofSha256)
    || packet.sourceIntake.documents !== documents.size
    || packet.summary.reviewRows !== packet.rows.length
    || packet.summary.documents !== documents.size
    || packet.summary.committees !== committees.size
    || packet.summary.candidateTargetEvents !== events.size
    || packet.summary.candidateBills !== bills.size
    || packet.summary.completedDecisions !== 0
    || packet.reviewKeySha256 !== setSha(reviewKeys)
    || new Set(reviewKeys).size !== reviewKeys.length
    || packet.reviewPacketProofSha256 !== packetProof(packet)
    || JSON.stringify(packet.allowedDecisionValues)
      !== JSON.stringify(SENATE_PRINT_MINUTE_PACKET_DECISIONS)
    || packet.policy.sourceDocumentContentReadByGenerator !== false
    || packet.policy.targetVoteOutcomesRead !== false
    || packet.policy.outcomeUse !== 'none'
    || packet.policy.decisionsAutoFilled !== false
    || packet.policy.billApplicabilityInferred !== false
    || packet.policy.memberAttributionInferred !== false
    || packet.policy.memberStanceInferred !== false
    || packet.policy.ambiguousDefaultsToFailClosed !== true
    || packet.policy.reviewOutputCreatesEvidence !== false
    || packet.policy.productionDatabaseQueried !== false
    || packet.policy.productionWrites !== false
    || packet.policy.featureRowsWritten !== false
    || packet.policy.modelFitting !== 'none'
    || packet.policy.servingChanged !== false
    || packet.policy.vercelUsed !== false
  ) {
    throw new Error('Senate print-minute review packet identity/policy drifted');
  }
  for (let index = 0; index < packet.rows.length; index += 1) {
    const row = packet.rows[index]!;
    if (
      row.row !== index + 1
      || row.reviewKey
        !== [row.sourceContentSha256, row.candidateTarget.voteEventId, row.candidateTarget.billId].join('|')
      || !isSha(row.sourceContentSha256)
      || !row.documentId.trim()
      || !row.candidateTarget.identifier.trim()
      || !(row.documentDate < row.candidateTarget.targetVoteDate)
      || row.candidateTarget.targetVoteDate !== row.candidateTarget.requestWindowEndExclusive
    ) {
      throw new Error(`Invalid Senate print-minute review packet row ${row.row}`);
    }
  }
  return packet;
}

function documentMap(
  bundle: SenatePrintMinuteIntakeBundle,
): Map<string, SenatePrintMinuteIntakeDocument> {
  return new Map(bundle.documents.map((document) => [document.id, document] as const));
}

function validatePacketAgainstIntake(
  packet: SenatePrintMinuteReviewPacket,
  bundle: SenatePrintMinuteIntakeBundle,
): void {
  const documents = documentMap(bundle);
  const expectedKeys: string[] = [];
  for (const document of bundle.documents) {
    for (const target of document.candidateTargets) {
      expectedKeys.push(
        [document.contentSha256, target.voteEventId, target.billId].join('|'),
      );
    }
  }
  const expectedSourceHashes = [...new Set(
    bundle.documents.map((document) => document.contentSha256),
  )].sort();
  if (
    packet.sourceIntake.documents !== bundle.documents.length
    || JSON.stringify([...packet.sourceIntake.sourceContentSha256Set].sort())
      !== JSON.stringify(expectedSourceHashes)
    || packet.reviewKeySha256 !== setSha(expectedKeys)
    || packet.rows.length !== expectedKeys.length
  ) {
    throw new Error('Review packet does not match intake-bundle candidate set');
  }
  for (const row of packet.rows) {
    const document = documents.get(row.documentId);
    const target = document?.candidateTargets.find(
      (candidate) =>
        candidate.voteEventId === row.candidateTarget.voteEventId
        && candidate.billId === row.candidateTarget.billId
        && candidate.identifier === row.candidateTarget.identifier,
    );
    if (
      !document
      || !target
      || document.contentSha256 !== row.sourceContentSha256
      || document.committeeEventId !== row.committeeEventId
      || document.committeeName !== row.committeeName
      || document.documentDate !== row.documentDate
    ) {
      throw new Error(`Review packet/intake mismatch for row ${row.row}`);
    }
  }
}

function manifestPolicy() {
  return {
    outcomeUse: 'none' as const,
    targetVoteOutcomesConsulted: false as const,
    partyOrIdeologyUsed: false as const,
    committeeMembershipUsedAsStance: false as const,
    attendanceUsedAsStance: false as const,
    proceduralActionUsedAsDirectionalStance: false as const,
    packetRowsRequireExplicitDecision: true as const,
    fullDocumentReviewRequired: true as const,
    exactBillMentionRequiredForDirectional: true as const,
    explicitNamedMemberAttributionRequired: true as const,
    wholeBillPositionRequired: true as const,
  };
}

export function buildSenatePrintMinuteReviewCompletionTemplate(input: {
  packet: SenatePrintMinuteReviewPacket;
  intakeBundle: SenatePrintMinuteIntakeBundle;
  intakeBundleSha256: string;
}): Record<string, unknown> {
  validateSenatePrintMinuteReviewPacket(input.packet);
  validatePacketAgainstIntake(input.packet, input.intakeBundle);
  if (!isSha(input.intakeBundleSha256)) {
    throw new Error('intakeBundleSha256 must be SHA-256');
  }
  const attestations = [...input.intakeBundle.documents]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((document) => ({
      documentId: document.id,
      sourceContentSha256: document.contentSha256,
      committeeName: document.committeeName,
      documentDate: document.documentDate,
      pageCount: document.pageCount,
      fullDocumentReviewed: null,
      notes: [] as string[],
    }));
  const decisions: SenatePrintMinuteReviewCompletionDecision[] =
    input.packet.rows.map((row) => ({
      row: row.row,
      reviewKey: row.reviewKey,
      documentId: row.documentId,
      candidateBillIdentifier: row.candidateTarget.identifier,
      candidateTargetEventId: row.candidateTarget.voteEventId,
      decision: null,
      reasonCode: null,
      billMentionExcerpt: null,
      billMentionPage: null,
      memberName: null,
      attributedMemberText: null,
      memberStance: null,
      claimType: null,
      explicitness: null,
      scope: null,
      normalizedClaim: null,
      supportingExcerpt: null,
      supportingPage: null,
      extractionConfidence: null,
      transcriptionVerifiedAgainstSourcePage: null,
      notes: [],
    }));
  const frozenReviewPacket = {
    reviewKeySha256: input.packet.reviewKeySha256,
    reviewPacketProofSha256: input.packet.reviewPacketProofSha256,
    reviewRows: input.packet.rows.length,
    sourceLedgerProofSha256: input.packet.sourceIntake.sourceLedgerProofSha256,
  };
  return {
    schemaVersion: SENATE_PRINT_MINUTE_REVIEW_COMPLETION_TEMPLATE_SCHEMA,
    frozenReviewPacket,
    intakeBundleSha256: input.intakeBundleSha256,
    instructions: {
      fullDocumentReview:
        'Set every documentAttestation.fullDocumentReviewed=true only after reviewing the entire authoritative minute.',
      rowCoverage:
        'Every frozen packet row requires one explicit decision; null decisions fail closed.',
      directional:
        'directional_member_statement requires exact candidate bill grounding, explicit named-member attribution, a whole-bill supports/opposes position, source pages, and verified transcription.',
      nonDirectional:
        'Use bill_context_only_no_member_direction, not_applicable_to_candidate_bill, or ambiguous_fail_closed without inventing member stance.',
    },
    manifestSkeleton: {
      schemaVersion: SENATE_PRINT_MINUTE_REVIEW_COMPLETION_MANIFEST_SCHEMA,
      batchId: 'REPLACE_WITH_BATCH_ID',
      intakeBundleSha256: input.intakeBundleSha256,
      reviewedOn: 'YYYY-MM-DD',
      reviewMethod: 'human_manual_full_document',
      frozenReviewPacket,
      documentAttestations: attestations,
      decisions,
      policy: manifestPolicy(),
    },
  };
}

function nullDirectionalFields(
  decision: SenatePrintMinuteReviewCompletionDecision,
): boolean {
  return [
    decision.memberName,
    decision.attributedMemberText,
    decision.memberStance,
    decision.claimType,
    decision.explicitness,
    decision.scope,
    decision.normalizedClaim,
    decision.supportingExcerpt,
    decision.supportingPage,
    decision.extractionConfidence,
    decision.transcriptionVerifiedAgainstSourcePage,
  ].every((value) => value === null);
}

function validPage(
  page: number | null,
  document: SenatePrintMinuteIntakeDocument,
  label: string,
): number {
  if (
    page === null
    || !Number.isInteger(page)
    || page <= 0
    || (document.pageCount !== null && page > document.pageCount)
  ) {
    throw new Error(`Invalid ${label} for ${document.id}`);
  }
  return page;
}

function containsExactBill(excerpt: string, identifier: string): boolean {
  const source = excerpt.toUpperCase();
  const target = identifier.toUpperCase();
  let index = source.indexOf(target);
  while (index >= 0) {
    const before = index === 0 ? '' : source[index - 1]!;
    const afterIndex = index + target.length;
    const after = afterIndex >= source.length ? '' : source[afterIndex]!;
    if (
      (before === '' || !/[A-Z0-9]/.test(before))
      && (after === '' || !/[A-Z0-9]/.test(after))
    ) return true;
    index = source.indexOf(target, index + 1);
  }
  return false;
}

function validateCompletion(
  packet: SenatePrintMinuteReviewPacket,
  bundle: SenatePrintMinuteIntakeBundle,
  intakeBundleSha256: string,
  manifest: SenatePrintMinuteReviewCompletionManifest,
): void {
  const expectedFrozen = {
    reviewKeySha256: packet.reviewKeySha256,
    reviewPacketProofSha256: packet.reviewPacketProofSha256,
    reviewRows: packet.rows.length,
    sourceLedgerProofSha256: packet.sourceIntake.sourceLedgerProofSha256,
  };
  if (
    manifest.schemaVersion !== SENATE_PRINT_MINUTE_REVIEW_COMPLETION_MANIFEST_SCHEMA
    || !manifest.batchId.trim()
    || manifest.intakeBundleSha256 !== intakeBundleSha256
    || dateOnly(manifest.reviewedOn, 'reviewedOn') !== manifest.reviewedOn
    || manifest.reviewMethod !== 'human_manual_full_document'
    || JSON.stringify(manifest.frozenReviewPacket) !== JSON.stringify(expectedFrozen)
    || JSON.stringify(manifest.policy) !== JSON.stringify(manifestPolicy())
  ) {
    throw new Error('Senate print-minute review completion manifest identity/policy drifted');
  }

  const documents = documentMap(bundle);
  if (manifest.documentAttestations.length !== documents.size) {
    throw new Error('Every intake document requires one full-review attestation');
  }
  const attested = new Set<string>();
  for (const attestation of manifest.documentAttestations) {
    const document = documents.get(attestation.documentId);
    if (
      !document
      || attested.has(attestation.documentId)
      || attestation.sourceContentSha256 !== document.contentSha256
      || attestation.fullDocumentReviewed !== true
      || !Array.isArray(attestation.notes)
    ) {
      throw new Error(`Invalid document review attestation ${attestation.documentId}`);
    }
    attested.add(attestation.documentId);
  }

  if (manifest.decisions.length !== packet.rows.length) {
    throw new Error('Every packet row requires one explicit completion decision');
  }
  const packetByKey = new Map(packet.rows.map((row) => [row.reviewKey, row] as const));
  const seen = new Set<string>();
  for (const decision of manifest.decisions) {
    const row = packetByKey.get(decision.reviewKey);
    const document = row ? documents.get(row.documentId) : undefined;
    if (
      !row
      || !document
      || seen.has(decision.reviewKey)
      || decision.row !== row.row
      || decision.documentId !== row.documentId
      || decision.candidateBillIdentifier !== row.candidateTarget.identifier
      || decision.candidateTargetEventId !== row.candidateTarget.voteEventId
      || !decision.decision
      || !SENATE_PRINT_MINUTE_PACKET_DECISIONS.includes(decision.decision)
      || !Array.isArray(decision.notes)
    ) {
      throw new Error(`Invalid completed review row ${decision.reviewKey}`);
    }
    seen.add(decision.reviewKey);

    const reason = compact(decision.reasonCode);
    if (decision.decision === 'directional_member_statement') {
      const billExcerpt = compact(decision.billMentionExcerpt);
      const supportingExcerpt = compact(decision.supportingExcerpt);
      if (
        reason
        || !billExcerpt
        || !supportingExcerpt
        || !containsExactBill(billExcerpt, row.candidateTarget.identifier)
        || !containsExactBill(supportingExcerpt, row.candidateTarget.identifier)
        || !compact(decision.memberName)
        || !compact(decision.attributedMemberText)
        || !['supports', 'opposes'].includes(decision.memberStance ?? '')
        || !['quoted_position', 'explicit_position'].includes(decision.claimType ?? '')
        || !['direct_quote', 'attributed_paraphrase'].includes(decision.explicitness ?? '')
        || decision.scope !== 'whole_bill'
        || !compact(decision.normalizedClaim)
        || decision.transcriptionVerifiedAgainstSourcePage !== true
        || !Number.isFinite(decision.extractionConfidence)
        || (decision.extractionConfidence ?? -1) < 0
        || (decision.extractionConfidence ?? 2) > 1
      ) {
        throw new Error(`Incomplete directional completion row ${decision.reviewKey}`);
      }
      validPage(decision.billMentionPage, document, 'billMentionPage');
      validPage(decision.supportingPage, document, 'supportingPage');
    } else if (decision.decision === 'bill_context_only_no_member_direction') {
      if (
        !reason
        || !compact(decision.billMentionExcerpt)
        || !containsExactBill(
          compact(decision.billMentionExcerpt),
          row.candidateTarget.identifier,
        )
        || !nullDirectionalFields(decision)
      ) {
        throw new Error(`Invalid bill-context completion row ${decision.reviewKey}`);
      }
      validPage(decision.billMentionPage, document, 'billMentionPage');
    } else if (
      !reason
      || decision.billMentionExcerpt !== null
      || decision.billMentionPage !== null
      || !nullDirectionalFields(decision)
    ) {
      throw new Error(`Invalid fail-closed completion row ${decision.reviewKey}`);
    }
  }
  if (seen.size !== packet.rows.length) {
    throw new Error('Review completion row coverage drifted');
  }
}

function documentReason(
  decisions: readonly SenatePrintMinuteReviewCompletionDecision[],
): 'no_candidate_bill_mention' | 'bill_mention_without_named_member_position' | 'other_fail_closed' {
  if (decisions.some((row) => row.decision === 'ambiguous_fail_closed')) {
    return 'other_fail_closed';
  }
  if (decisions.some((row) => row.decision === 'bill_context_only_no_member_direction')) {
    return 'bill_mention_without_named_member_position';
  }
  return 'no_candidate_bill_mention';
}

export function finalizeSenatePrintMinuteReview(input: {
  packet: SenatePrintMinuteReviewPacket;
  intakeBundle: SenatePrintMinuteIntakeBundle;
  intakeBundleSha256: string;
  completion: SenatePrintMinuteReviewCompletionManifest;
  generatedAt?: string;
}): {
  finalization: SenatePrintMinuteReviewFinalization;
  semanticReview: SenatePrintMinuteSemanticReviewBundle;
} {
  validateSenatePrintMinuteReviewPacket(input.packet);
  validatePacketAgainstIntake(input.packet, input.intakeBundle);
  if (!isSha(input.intakeBundleSha256)) {
    throw new Error('intakeBundleSha256 must be SHA-256');
  }
  validateCompletion(
    input.packet,
    input.intakeBundle,
    input.intakeBundleSha256,
    input.completion,
  );

  const packetByKey = new Map(input.packet.rows.map((row) => [row.reviewKey, row] as const));
  const documents = documentMap(input.intakeBundle);
  const decisionsByDocument = new Map<string, SenatePrintMinuteReviewCompletionDecision[]>();
  for (const decision of input.completion.decisions) {
    const row = packetByKey.get(decision.reviewKey)!;
    const values = decisionsByDocument.get(row.documentId) ?? [];
    values.push(decision);
    decisionsByDocument.set(row.documentId, values);
  }
  const attestationByDocument = new Map(
    input.completion.documentAttestations.map((row) => [row.documentId, row] as const),
  );

  const semanticManifest: SenatePrintMinuteSemanticReviewManifest = {
    schemaVersion:
      'historical-density-2021-senate-print-minute-semantic-review-manifest-v1',
    batchId: input.completion.batchId,
    intakeBundleSha256: input.intakeBundleSha256,
    reviewedOn: input.completion.reviewedOn,
    reviewMethod: 'human_manual_full_document',
    reviews: [...documents.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((document) => {
        const decisions = decisionsByDocument.get(document.id) ?? [];
        const directional = decisions.filter(
          (decision) => decision.decision === 'directional_member_statement',
        );
        const attestation = attestationByDocument.get(document.id)!;
        const rowNotes = decisions.flatMap((decision) =>
          decision.notes.map((note) => `${decision.reviewKey}: ${note}`));
        if (directional.length === 0) {
          return {
            documentId: document.id,
            sourceContentSha256: document.contentSha256,
            fullDocumentReviewed: true as const,
            decision: 'no_directional_claims' as const,
            reasonCode: documentReason(decisions),
            notes: [...attestation.notes, ...rowNotes],
            claims: [],
          };
        }
        return {
          documentId: document.id,
          sourceContentSha256: document.contentSha256,
          fullDocumentReviewed: true as const,
          decision: 'directional_claims' as const,
          notes: [...attestation.notes, ...rowNotes],
          claims: directional.map((decision) => ({
            sourcePage: decision.supportingPage!,
            billIdentifier: decision.candidateBillIdentifier,
            memberName: decision.memberName!,
            attributedMemberText: decision.attributedMemberText!,
            stance: decision.memberStance!,
            claimType: decision.claimType!,
            explicitness: decision.explicitness!,
            scope: 'whole_bill' as const,
            normalizedClaim: decision.normalizedClaim!,
            supportingExcerpt: decision.supportingExcerpt!,
            extractionConfidence: decision.extractionConfidence!,
            transcriptionVerifiedAgainstSourcePage: true as const,
          })),
        };
      }),
    policy: {
      outcomeUse: 'none',
      targetVoteOutcomesConsulted: false,
      partyOrIdeologyUsed: false,
      committeeMembershipUsedAsStance: false,
      attendanceUsedAsStance: false,
      proceduralActionUsedAsDirectionalStance: false,
      exactBillMentionRequired: true,
      explicitNamedMemberAttributionRequired: true,
      wholeBillPositionRequired: true,
    },
  };

  const semanticReview = buildSenatePrintMinuteSemanticReviewBundle({
    intakeBundle: input.intakeBundle,
    intakeBundleSha256: input.intakeBundleSha256,
    manifest: semanticManifest,
    generatedAt: input.generatedAt,
  });
  const semanticReviewText = JSON.stringify(semanticReview, null, 2) + '\n';

  const attestations = [...input.completion.documentAttestations]
    .map((row) => ({ ...row, notes: [...row.notes] }))
    .sort((a, b) => a.documentId.localeCompare(b.documentId));
  const decisions = [...input.completion.decisions]
    .map((row) => ({ ...row, notes: [...row.notes] }))
    .sort((a, b) => a.row - b.row);

  const documentAttestationProofSha256 = setSha(
    attestations.map((row) => [
      row.documentId,
      row.sourceContentSha256,
      row.fullDocumentReviewed,
      row.notes.join(' | '),
    ].join('|')),
  );
  const rowDecisionProofSha256 = setSha(
    decisions.map((row) => [
      row.row,
      row.reviewKey,
      row.decision,
      row.reasonCode ?? '',
      row.billMentionExcerpt ?? '',
      row.billMentionPage ?? '',
      row.memberName ?? '',
      row.attributedMemberText ?? '',
      row.memberStance ?? '',
      row.claimType ?? '',
      row.explicitness ?? '',
      row.scope ?? '',
      row.normalizedClaim ?? '',
      row.supportingExcerpt ?? '',
      row.supportingPage ?? '',
      row.extractionConfidence ?? '',
      row.transcriptionVerifiedAgainstSourcePage ?? '',
      row.notes.join(' | '),
    ].join('|')),
  );

  const summary = {
    reviewRows: decisions.length,
    directionalRows: decisions.filter(
      (row) => row.decision === 'directional_member_statement',
    ).length,
    billContextRows: decisions.filter(
      (row) => row.decision === 'bill_context_only_no_member_direction',
    ).length,
    notApplicableRows: decisions.filter(
      (row) => row.decision === 'not_applicable_to_candidate_bill',
    ).length,
    ambiguousRows: decisions.filter(
      (row) => row.decision === 'ambiguous_fail_closed',
    ).length,
    documentsReviewed: attestations.length,
    semanticClaims: semanticReview.summary.semanticClaims,
    candidateTargetEvents: semanticReview.summary.candidateTargetEvents,
    candidateBills: semanticReview.summary.candidateBills,
  };
  const policy = {
    outcomeUse: 'none' as const,
    targetVoteOutcomesConsulted: false as const,
    packetRowsFullyAdjudicated: true as const,
    fullDocumentReviewAttested: true as const,
    nonDirectionalRowsPreservedInAudit: true as const,
    semanticClaimsValidatedByCanonicalReviewer: true as const,
    publicIdentityResolved: false as const,
    internalMembershipIdentityResolved: false as const,
    mechanicallyActionable: false as const,
    modelWeight: 0 as const,
    productionDatabaseQueried: false as const,
    productionWrites: false as const,
    featureRowsWritten: false as const,
    modelFitting: 'none' as const,
    servingChanged: false as const,
    vercelUsed: false as const,
  };

  return {
    semanticReview,
    finalization: {
      schemaVersion: SENATE_PRINT_MINUTE_REVIEW_FINALIZATION_SCHEMA,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      batchId: input.completion.batchId,
      intakeBundleSha256: input.intakeBundleSha256,
      frozenReviewPacket: input.completion.frozenReviewPacket,
      summary,
      documentAttestations: attestations,
      decisions,
      documentAttestationProofSha256,
      rowDecisionProofSha256,
      semanticReviewProofSha256: semanticReview.reviewProofSha256,
      semanticReviewBundleSha256: sha256(semanticReviewText),
      policy,
    },
  };
}
