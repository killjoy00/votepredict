import { createHash } from 'node:crypto';

export const SENATE_PRINT_MINUTE_REQUEST_PACKAGE_SCHEMA =
  'historical-density-2021-senate-print-minute-request-package-v1' as const;
export const SENATE_PRINT_MINUTE_INTAKE_BUNDLE_SCHEMA =
  'historical-density-2021-senate-print-minute-intake-bundle-v1' as const;
export const SENATE_PRINT_MINUTE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/tiff',
  'image/png',
  'image/jpeg',
] as const;

export type SenatePrintMinuteMimeType =
  (typeof SENATE_PRINT_MINUTE_ALLOWED_MIME_TYPES)[number];
export type SenatePrintMinuteAcquisitionMethod =
  | 'lrl_supplied_copy'
  | 'on_site_scan_of_lrl_holdings';

export interface SenatePrintMinuteRequestTarget {
  rank: number;
  committeeEventId: string;
  committeeName: string;
  voteEventId: string;
  billId: string;
  identifier: string;
  targetVoteDate: string;
  uncoveredRows: number;
  referralDates: string[];
  requestWindowStart: string;
  requestWindowEndExclusive: string;
}
export interface SenatePrintMinuteRequestGroup {
  rank: number;
  committeeEventId: string;
  committeeName: string;
  recordingPages: number;
  requestAssociations: number;
  uniqueRequestBills: number;
  targets: SenatePrintMinuteRequestTarget[];
}
export interface SenatePrintMinuteRequestPackage {
  schemaVersion: typeof SENATE_PRINT_MINUTE_REQUEST_PACKAGE_SCHEMA;
  issue: number;
  request: {
    committees: number;
    targetAssociations: number;
    uniqueTargetEvents: number;
    uniqueTargetBills: number;
    selectedCommitteeRecordingPages: number;
    selectedUncoveredRows: number;
    requestAssociationProofSha256: string;
    groups: SenatePrintMinuteRequestGroup[];
  };
  interpretation: {
    acquisitionOnly: boolean;
    requestDoesNotAssertMinuteExists: boolean;
    returnedMinuteDoesNotAutomaticallyBecomeEvidence: boolean;
  };
  policy: {
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    targetVoteOutcomesRead: boolean;
    outcomeUse: string;
    memberStanceInferred: boolean;
    referralTreatedAsEvidence: boolean;
    mediaPresenceTreatedAsEvidence: boolean;
    printMinuteContentAcquired: boolean;
    featureRowsWritten: boolean;
    modelFitting: string;
    servingChanged: boolean;
    vercelUsed: boolean;
  };
}

export interface SenatePrintMinuteProvenance {
  repository: 'Minnesota Legislative Reference Library';
  acquisitionMethod: SenatePrintMinuteAcquisitionMethod;
  lrlReference: string;
  acquiredOn: string;
}
export interface SenatePrintMinuteCandidateTarget {
  voteEventId: string;
  billId: string;
  identifier: string;
  targetVoteDate: string;
  requestWindowStart: string;
  requestWindowEndExclusive: string;
  referralDates: string[];
}
export interface SenatePrintMinuteIntakeDocument {
  id: string;
  sourceClass: 'senate_print_committee_minute';
  committeeEventId: string;
  committeeName: string;
  documentDate: string;
  fileName: string;
  mimeType: SenatePrintMinuteMimeType;
  bytes: number;
  contentSha256: string;
  pageCount: number | null;
  title: string;
  provenance: SenatePrintMinuteProvenance;
  candidateTargets: SenatePrintMinuteCandidateTarget[];
  candidateTargetEventIds: string[];
  candidateBillIdentifiers: string[];
  semanticStatus: 'unreviewed';
  evidenceStatus: 'not_evidence';
  mechanicallyActionable: false;
  modelWeight: 0;
}
export interface SenatePrintMinuteIntakeBundle {
  schemaVersion: typeof SENATE_PRINT_MINUTE_INTAKE_BUNDLE_SCHEMA;
  generatedAt: string;
  requestPackage: {
    artifactId: number;
    artifactDigest: string;
    sourceCommitSha: string;
    requestAssociationProofSha256: string;
  };
  summary: {
    documents: number;
    committees: number;
    candidateTargetEvents: number;
    candidateBills: number;
  };
  documents: SenatePrintMinuteIntakeDocument[];
  policy: {
    productionDatabaseQueried: false;
    productionWrites: false;
    targetVoteOutcomesRead: false;
    outcomeUse: 'none';
    documentDateMustBeStrictPreVote: true;
    committeeAndDateMatchCreatesCandidateOnly: true;
    billMentionRequiredBeforeSemanticApplicability: true;
    memberAttributionRequiredBeforeDirectionalEvidence: true;
    returnedMinuteAutomaticallyEvidence: false;
    featureRowsWritten: false;
    modelFitting: 'none';
    modelWeightChanged: false;
    servingChanged: false;
    vercelUsed: false;
  };
}

function dateOnly(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a valid date`);
  }
  return value;
}
function nonempty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

export function validateSenatePrintMinuteRequestPackage(
  request: SenatePrintMinuteRequestPackage,
): SenatePrintMinuteRequestPackage {
  if (
    request.schemaVersion !== SENATE_PRINT_MINUTE_REQUEST_PACKAGE_SCHEMA
    || request.issue !== 718
    || request.request.committees !== 10
    || request.request.targetAssociations !== 85
    || request.request.uniqueTargetEvents !== 62
    || request.request.uniqueTargetBills !== 57
    || request.request.selectedCommitteeRecordingPages !== 208
    || request.request.selectedUncoveredRows !== 4154
    || request.request.groups.length !== 10
    || !/^[a-f0-9]{64}$/.test(request.request.requestAssociationProofSha256)
    || request.interpretation.acquisitionOnly !== true
    || request.interpretation.requestDoesNotAssertMinuteExists !== true
    || request.interpretation.returnedMinuteDoesNotAutomaticallyBecomeEvidence !== true
    || request.policy.productionDatabaseQueried !== false
    || request.policy.productionWrites !== false
    || request.policy.targetVoteOutcomesRead !== false
    || request.policy.outcomeUse !== 'none'
    || request.policy.memberStanceInferred !== false
    || request.policy.referralTreatedAsEvidence !== false
    || request.policy.mediaPresenceTreatedAsEvidence !== false
    || request.policy.printMinuteContentAcquired !== false
    || request.policy.featureRowsWritten !== false
    || request.policy.modelFitting !== 'none'
    || request.policy.servingChanged !== false
    || request.policy.vercelUsed !== false
  ) throw new Error('Senate print-minute request package identity/policy drifted');

  const groupIds = new Set<string>();
  const associations = new Set<string>();
  const eventIds = new Set<string>();
  const bills = new Set<string>();
  for (const group of request.request.groups) {
    if (
      !Number.isInteger(group.rank)
      || group.rank < 1 || group.rank > 10
      || groupIds.has(group.committeeEventId)
      || !group.committeeEventId.trim()
      || !group.committeeName.trim()
      || group.requestAssociations !== group.targets.length
    ) throw new Error(`Invalid request group ${group.committeeEventId}`);
    groupIds.add(group.committeeEventId);
    for (const target of group.targets) {
      if (
        target.rank !== group.rank
        || target.committeeEventId !== group.committeeEventId
        || target.committeeName !== group.committeeName
        || target.referralDates.length === 0
      ) throw new Error(`Request target/group mismatch ${target.voteEventId}`);
      const start = dateOnly(target.requestWindowStart, 'requestWindowStart');
      const end = dateOnly(target.requestWindowEndExclusive, 'requestWindowEndExclusive');
      if (dateOnly(target.targetVoteDate, 'targetVoteDate') !== end || !(start < end)) {
        throw new Error(`Invalid request window ${target.voteEventId}`);
      }
      for (const referral of target.referralDates) {
        if (!(dateOnly(referral, 'referralDate') < end)) {
          throw new Error(`Referral is not strict-pre-vote ${target.voteEventId}`);
        }
      }
      const key = `${group.committeeEventId}|${target.voteEventId}`;
      if (associations.has(key)) throw new Error(`Duplicate committee-target association ${key}`);
      associations.add(key);
      eventIds.add(target.voteEventId);
      bills.add(target.billId);
    }
  }
  if (groupIds.size !== 10 || associations.size !== 85 || eventIds.size !== 62 || bills.size !== 57) {
    throw new Error('Senate print-minute request package cardinality drifted');
  }
  return request;
}

export function senatePrintMinuteCandidateTargets(
  request: SenatePrintMinuteRequestPackage,
  input: { committeeEventId: string; committeeName: string; documentDate: string },
): SenatePrintMinuteCandidateTarget[] {
  validateSenatePrintMinuteRequestPackage(request);
  const documentDate = dateOnly(input.documentDate, 'documentDate');
  const group = request.request.groups.find((item) => item.committeeEventId === input.committeeEventId);
  if (!group || group.committeeName !== input.committeeName) {
    throw new Error('Minute committee identity is outside the frozen request');
  }
  return group.targets
    .filter((target) => target.requestWindowStart <= documentDate && documentDate < target.requestWindowEndExclusive)
    .map((target) => ({
      voteEventId: target.voteEventId,
      billId: target.billId,
      identifier: target.identifier,
      targetVoteDate: target.targetVoteDate,
      requestWindowStart: target.requestWindowStart,
      requestWindowEndExclusive: target.requestWindowEndExclusive,
      referralDates: [...target.referralDates].sort(),
    }))
    .sort((a, b) => a.targetVoteDate.localeCompare(b.targetVoteDate)
      || a.identifier.localeCompare(b.identifier)
      || a.voteEventId.localeCompare(b.voteEventId));
}

export function collectSenatePrintMinuteIntakeDocument(input: {
  request: SenatePrintMinuteRequestPackage;
  committeeEventId: string;
  committeeName: string;
  documentDate: string;
  fileName: string;
  mimeType: SenatePrintMinuteMimeType;
  bytes: Buffer;
  pageCount?: number | null;
  title?: string;
  provenance: SenatePrintMinuteProvenance;
}): SenatePrintMinuteIntakeDocument {
  const committeeEventId = nonempty(input.committeeEventId, 'committeeEventId');
  const committeeName = nonempty(input.committeeName, 'committeeName');
  const documentDate = dateOnly(input.documentDate, 'documentDate');
  const fileName = nonempty(input.fileName, 'fileName');
  if (!SENATE_PRINT_MINUTE_ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`Unsupported Senate print-minute MIME type: ${input.mimeType}`);
  }
  if (input.bytes.length === 0 || input.bytes.length > 100_000_000) {
    throw new Error(`Invalid Senate print-minute byte length: ${input.bytes.length}`);
  }
  if (input.pageCount != null && (!Number.isInteger(input.pageCount) || input.pageCount <= 0)) {
    throw new Error('pageCount must be a positive integer when provided');
  }
  if (
    input.provenance.repository !== 'Minnesota Legislative Reference Library'
    || !['lrl_supplied_copy', 'on_site_scan_of_lrl_holdings'].includes(input.provenance.acquisitionMethod)
  ) throw new Error('Minute provenance is not an approved LRL acquisition path');
  nonempty(input.provenance.lrlReference, 'lrlReference');
  dateOnly(input.provenance.acquiredOn, 'acquiredOn');

  const candidateTargets = senatePrintMinuteCandidateTargets(input.request, {
    committeeEventId, committeeName, documentDate,
  });
  if (candidateTargets.length === 0) {
    throw new Error('Minute date does not fall inside any frozen committee request window');
  }
  const contentSha256 = createHash('sha256').update(input.bytes).digest('hex');
  return {
    id: `senate-print-minute-${committeeEventId}-${documentDate}-${contentSha256.slice(0, 16)}`,
    sourceClass: 'senate_print_committee_minute',
    committeeEventId,
    committeeName,
    documentDate,
    fileName,
    mimeType: input.mimeType,
    bytes: input.bytes.length,
    contentSha256,
    pageCount: input.pageCount ?? null,
    title: input.title?.trim()
      || `Minnesota Senate print committee minute — ${committeeName} — ${documentDate}`,
    provenance: { ...input.provenance, lrlReference: input.provenance.lrlReference.trim() },
    candidateTargets,
    candidateTargetEventIds: [...new Set(candidateTargets.map((target) => target.voteEventId))].sort(),
    candidateBillIdentifiers: [...new Set(candidateTargets.map((target) => target.identifier))].sort(),
    semanticStatus: 'unreviewed',
    evidenceStatus: 'not_evidence',
    mechanicallyActionable: false,
    modelWeight: 0,
  };
}

export function buildSenatePrintMinuteIntakeBundle(input: {
  request: SenatePrintMinuteRequestPackage;
  requestPackageArtifactId: number;
  requestPackageArtifactDigest: string;
  requestPackageSourceCommitSha: string;
  documents: SenatePrintMinuteIntakeDocument[];
  generatedAt?: string;
}): SenatePrintMinuteIntakeBundle {
  validateSenatePrintMinuteRequestPackage(input.request);
  if (!Number.isInteger(input.requestPackageArtifactId) || input.requestPackageArtifactId <= 0) {
    throw new Error('requestPackageArtifactId must be positive');
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(input.requestPackageArtifactDigest)) {
    throw new Error('requestPackageArtifactDigest must be a sha256 artifact digest');
  }
  if (!/^[a-f0-9]{40}$/.test(input.requestPackageSourceCommitSha)) {
    throw new Error('requestPackageSourceCommitSha must be a git SHA');
  }
  const ids = new Set<string>(), hashes = new Set<string>(), committees = new Set<string>();
  const targetEvents = new Set<string>(), bills = new Set<string>();
  for (const document of input.documents) {
    if (ids.has(document.id)) throw new Error(`Duplicate intake document id: ${document.id}`);
    if (hashes.has(document.contentSha256)) throw new Error(`Duplicate intake document bytes: ${document.contentSha256}`);
    ids.add(document.id); hashes.add(document.contentSha256); committees.add(document.committeeEventId);
    if (
      document.sourceClass !== 'senate_print_committee_minute'
      || document.semanticStatus !== 'unreviewed'
      || document.evidenceStatus !== 'not_evidence'
      || document.mechanicallyActionable !== false
      || document.modelWeight !== 0
      || document.candidateTargets.length === 0
    ) throw new Error(`Unsafe intake document state: ${document.id}`);
    for (const target of document.candidateTargets) {
      if (!(document.documentDate < target.requestWindowEndExclusive)) {
        throw new Error(`Intake document is not strict-pre-vote: ${document.id}`);
      }
      targetEvents.add(target.voteEventId); bills.add(target.billId);
    }
  }
  return {
    schemaVersion: SENATE_PRINT_MINUTE_INTAKE_BUNDLE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requestPackage: {
      artifactId: input.requestPackageArtifactId,
      artifactDigest: input.requestPackageArtifactDigest,
      sourceCommitSha: input.requestPackageSourceCommitSha,
      requestAssociationProofSha256: input.request.request.requestAssociationProofSha256,
    },
    summary: {
      documents: input.documents.length,
      committees: committees.size,
      candidateTargetEvents: targetEvents.size,
      candidateBills: bills.size,
    },
    documents: [...input.documents].sort((a, b) => a.documentDate.localeCompare(b.documentDate)
      || a.committeeName.localeCompare(b.committeeName) || a.id.localeCompare(b.id)),
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      documentDateMustBeStrictPreVote: true,
      committeeAndDateMatchCreatesCandidateOnly: true,
      billMentionRequiredBeforeSemanticApplicability: true,
      memberAttributionRequiredBeforeDirectionalEvidence: true,
      returnedMinuteAutomaticallyEvidence: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };
}
