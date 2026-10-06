import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fetchRevisorBill, fetchRevisorBillVersion, type RevisorBillMetadata, type RevisorBillVersionMetadata } from '../src/sources/minnesota/revisor.js';
import { historicalBillIdentityTitle } from '../src/evaluation/historical-quick-replay.js';
import {
  P2_APPLICABILITY_CLAIM_RULES,
  applicabilityPatternHits,
  applicabilitySnippet,
  type P2ApplicabilityClaimRule,
} from '../src/evidence/historical-density-p2-applicability.js';

const TARGET_SESSION = '2021-2022';
const EXPECTED_RAW_MEMBER_EVENT_ROWS = 3924;
const EXPECTED_ELIGIBLE_MEMBER_EVENT_ROWS = 3923;
const EXPECTED_EVENTS = 218;
const EXPECTED_MEMBERSHIPS = 18;
const EXPECTED_DIRECTIONAL_DOCUMENTS = 17;
const EXPECTED_DIRECTIONAL_SEMANTIC_GROUPS = 14;
const EXPECTED_COHORT_INTEGRITY = '2cf9cd2a80a5586570aa67063dc34bc443748c5bbef2fa5dcc9b5c0ea33f0e2c';
const OUTPUT_FILE = 'historical-density-p2-applicability-candidate-audit-v1.json';
const ALLOWED_TARGET_KEYS = ['voteEventId','membershipId','legislatorId','session','chamber','occurredOn','billId','identifier'] as const;

type CohortDocument = {
  row: number;
  membershipId: string;
  session: string;
  availableAt: string;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
};

type Cohort = {
  artifactVersion: string;
  batchId: string;
  issue: number;
  documentsExpected: number;
  membershipsExpected: number;
  potential2021MemberEventRowsUpperBound: number;
  integritySha256: string;
  documents: CohortDocument[];
  policy: {
    outcomeBlind: boolean;
    billInferenceAllowed: boolean;
    candidateBillIdentifiersRequiredEmpty: boolean;
    outcomesQueried: boolean;
    modelFitting: boolean;
    servingChanged: boolean;
  };
};

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

type ClaimInstance = P2ApplicabilityClaimRule & {
  membershipId: string;
  availableAt: string;
  sourceRows: readonly number[];
};

type EventSource = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  status: 'verified' | 'no_strict_prevote_version' | 'status_fetch_failed' | 'version_fetch_failed';
  statusUrl?: string;
  versionUrl?: string;
  versionPostedOn?: string;
  versionOrdinal?: number;
  versionKey?: string;
  versionSha256?: string;
  identityTitle?: string;
  text?: string;
  error?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? (error.stack ?? error.message) : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1200);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function selectStrictPreVoteVersion(metadata: RevisorBillMetadata, occurredOn: string): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn < occurredOn)
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal)[0];
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, 700 * attempt));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function loadOutcomeBlindTargets(path: string): Promise<TargetRow[]> {
  const input = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  const rows: TargetRow[] = [];
  for await (const line of input) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();
    const expected = [...ALLOWED_TARGET_KEYS].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(`Outcome-blind target row schema drifted; saw keys: ${keys.join(',')}`);
    }
    rows.push(parsed as unknown as TargetRow);
  }
  return rows;
}

function buildClaimInstances(cohort: Cohort): ClaimInstance[] {
  const byRow = new Map(cohort.documents.map((document) => [document.row, document]));
  const claims: ClaimInstance[] = [];
  for (const rule of P2_APPLICABILITY_CLAIM_RULES) {
    const documents = rule.sourceRows.map((row) => byRow.get(row));
    if (documents.some((document) => !document)) throw new Error(`Missing frozen cohort row for ${rule.id}`);
    const typed = documents as CohortDocument[];
    const membershipIds = unique(typed.map((document) => document.membershipId));
    const memberNames = unique(typed.map((document) => document.candidateMemberNames[0]));
    if (membershipIds.length !== 1 || memberNames.length !== 1 || memberNames[0] !== rule.memberName) {
      throw new Error(`Frozen member identity drifted for ${rule.id}`);
    }
    if (typed.some((document) => document.session !== TARGET_SESSION || document.candidateBillIdentifiers.length !== 0)) {
      throw new Error(`Frozen P2 bill/session boundary drifted for ${rule.id}`);
    }
    claims.push({
      ...rule,
      membershipId: membershipIds[0]!,
      availableAt: typed.map((document) => document.availableAt).sort()[0]!,
    });
  }
  if (claims.length !== EXPECTED_DIRECTIONAL_SEMANTIC_GROUPS) {
    throw new Error(`Directional semantic group count drifted: ${claims.length}`);
  }
  if (claims.reduce((count, claim) => count + claim.sourceRows.length, 0) !== EXPECTED_DIRECTIONAL_DOCUMENTS) {
    throw new Error('Directional document count drifted');
  }
  return claims;
}

async function mapLimit<T, R>(values: readonly T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

async function materializeEventSources(events: TargetRow[]): Promise<Map<string, EventSource>> {
  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<string, Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>>();
  const ordered = [...events].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.voteEventId.localeCompare(b.voteEventId));
  const rows = await mapLimit<TargetRow, readonly [string, EventSource]>(ordered, 4, async (event) => {
    let metadata: RevisorBillMetadata;
    try {
      let pending = statusCache.get(event.identifier);
      if (!pending) {
        pending = retry(() => fetchRevisorBill(TARGET_SESSION, event.identifier, false));
        statusCache.set(event.identifier, pending);
      }
      metadata = await pending;
    } catch (error) {
      return [event.voteEventId, {
        voteEventId: event.voteEventId,
        billId: event.billId,
        identifier: event.identifier,
        occurredOn: event.occurredOn,
        status: 'status_fetch_failed',
        error: safeMessage(error),
      } satisfies EventSource] as const;
    }

    const selected = selectStrictPreVoteVersion(metadata, event.occurredOn);
    if (!selected) {
      return [event.voteEventId, {
        voteEventId: event.voteEventId,
        billId: event.billId,
        identifier: event.identifier,
        occurredOn: event.occurredOn,
        status: 'no_strict_prevote_version',
        statusUrl: metadata.sourceUrl,
      } satisfies EventSource] as const;
    }

    try {
      let pending = versionCache.get(selected.textUrl);
      if (!pending) {
        pending = retry(() => fetchRevisorBillVersion(selected));
        versionCache.set(selected.textUrl, pending);
      }
      const version = await pending;
      return [event.voteEventId, {
        voteEventId: event.voteEventId,
        billId: event.billId,
        identifier: event.identifier,
        occurredOn: event.occurredOn,
        status: 'verified',
        statusUrl: metadata.sourceUrl,
        versionUrl: version.textUrl,
        versionPostedOn: version.postedOn,
        versionOrdinal: version.ordinal,
        versionKey: version.versionKey,
        versionSha256: version.textSha256,
        identityTitle: historicalBillIdentityTitle(version.text, event.identifier),
        text: version.text,
      } satisfies EventSource] as const;
    } catch (error) {
      return [event.voteEventId, {
        voteEventId: event.voteEventId,
        billId: event.billId,
        identifier: event.identifier,
        occurredOn: event.occurredOn,
        status: 'version_fetch_failed',
        statusUrl: metadata.sourceUrl,
        versionUrl: selected.textUrl,
        versionPostedOn: selected.postedOn,
        versionOrdinal: selected.ordinal,
        versionKey: selected.versionKey,
        error: safeMessage(error),
      } satisfies EventSource] as const;
    }
  });
  return new Map(rows);
}

async function main() {
  const cohort = JSON.parse(readFileSync(requiredEnv('VOTEPREDICT_P2_REVIEW_COHORT_PATH'), 'utf8')) as Cohort;
  if (
    cohort.artifactVersion !== 'historical-density-p2-semantic-review-cohort-v1'
    || cohort.batchId !== 'EQV1-HISTORICAL-DENSITY-P2-001'
    || cohort.issue !== 718
    || cohort.documentsExpected !== 25
    || cohort.membershipsExpected !== EXPECTED_MEMBERSHIPS
    || cohort.potential2021MemberEventRowsUpperBound !== EXPECTED_ELIGIBLE_MEMBER_EVENT_ROWS
    || cohort.integritySha256 !== EXPECTED_COHORT_INTEGRITY
    || !cohort.policy.outcomeBlind
    || cohort.policy.billInferenceAllowed
    || !cohort.policy.candidateBillIdentifiersRequiredEmpty
    || cohort.policy.outcomesQueried
    || cohort.policy.modelFitting
    || cohort.policy.servingChanged
  ) throw new Error('Frozen P2 review cohort identity/policy drifted');

  const claims = buildClaimInstances(cohort);
  const cohortMemberships = new Set(cohort.documents.map((document) => document.membershipId));
  const earliestAnyEvidence = new Map<string, string>();
  for (const document of cohort.documents) {
    const current = earliestAnyEvidence.get(document.membershipId);
    if (!current || document.availableAt < current) earliestAnyEvidence.set(document.membershipId, document.availableAt);
  }

  const targetRows = (await loadOutcomeBlindTargets(requiredEnv('VOTEPREDICT_P2_OUTCOME_BLIND_TARGET_PATH')))
    .filter((row) => row.session === TARGET_SESSION && cohortMemberships.has(row.membershipId));
  if (targetRows.length !== EXPECTED_RAW_MEMBER_EVENT_ROWS) {
    throw new Error(`Raw member-event row count mismatch: ${targetRows.length}`);
  }
  if (new Set(targetRows.map((row) => row.membershipId)).size !== EXPECTED_MEMBERSHIPS) throw new Error('Membership coverage drifted');
  if (new Set(targetRows.map((row) => row.voteEventId)).size !== EXPECTED_EVENTS) throw new Error('Event coverage drifted');

  const eligibleRows = targetRows.filter((row) => (earliestAnyEvidence.get(row.membershipId) ?? '9999-12-31') < row.occurredOn);
  if (eligibleRows.length !== EXPECTED_ELIGIBLE_MEMBER_EVENT_ROWS) {
    throw new Error(`Eligible member-event row count mismatch: ${eligibleRows.length}`);
  }

  const events = [...new Map(eligibleRows.map((row) => [row.voteEventId, row])).values()];
  const eventSources = await materializeEventSources(events);
  const claimsByMembership = new Map<string, ClaimInstance[]>();
  for (const claim of claims) {
    const values = claimsByMembership.get(claim.membershipId) ?? [];
    values.push(claim);
    claimsByMembership.set(claim.membershipId, values);
  }

  const memberEvents = [] as Array<Record<string, unknown>>;
  const candidateClaims = [] as Array<Record<string, unknown>>;
  for (const row of eligibleRows) {
    const directionalClaims = (claimsByMembership.get(row.membershipId) ?? [])
      .filter((claim) => claim.availableAt < row.occurredOn);
    const source = eventSources.get(row.voteEventId);
    if (!source) throw new Error(`Missing event source ${row.voteEventId}`);

    if (directionalClaims.length === 0) {
      memberEvents.push({ ...row, status: 'not_applicable', reason: 'no_directional_frozen_claim', candidateClaimIds: [] });
      continue;
    }
    const screenableClaims = directionalClaims.filter((claim) => claim.screenPolicy === 'screen_issue_match');
    if (screenableClaims.length === 0) {
      memberEvents.push({
        ...row,
        status: 'not_applicable',
        reason: 'claim_not_specific_enough_for_bill_application',
        candidateClaimIds: [],
        rejectedClaimIds: directionalClaims.map((claim) => claim.id),
      });
      continue;
    }
    if (source.status !== 'verified' || !source.text) {
      memberEvents.push({
        ...row,
        status: 'ambiguous_fail_closed',
        reason: source.status,
        candidateClaimIds: [],
        versionProof: {
          statusUrl: source.statusUrl ?? null,
          versionUrl: source.versionUrl ?? null,
          versionPostedOn: source.versionPostedOn ?? null,
        },
      });
      continue;
    }

    const candidates: string[] = [];
    for (const claim of screenableClaims) {
      const hits = applicabilityPatternHits(source.text, claim);
      if (!hits.length) continue;
      candidates.push(claim.id);
      candidateClaims.push({
        voteEventId: row.voteEventId,
        membershipId: row.membershipId,
        memberName: claim.memberName,
        occurredOn: row.occurredOn,
        billId: row.billId,
        identifier: row.identifier,
        chamber: row.chamber,
        claimId: claim.id,
        sourceRows: claim.sourceRows,
        claimAvailableAt: claim.availableAt,
        memberStance: claim.stance,
        normalizedClaim: claim.normalizedClaim,
        issueFamily: claim.issueFamily,
        candidateOnly: true,
        applicabilityDecision: 'pending_semantic_review',
        billPolicyDirection: 'not_inferred_by_candidate_screen',
        alignmentDirection: 'not_inferred_by_candidate_screen',
        versionProof: {
          statusUrl: source.statusUrl,
          versionUrl: source.versionUrl,
          postedOn: source.versionPostedOn,
          ordinal: source.versionOrdinal,
          versionKey: source.versionKey,
          textSha256: source.versionSha256,
          identityTitle: source.identityTitle,
          strictlyBeforeVoteDate: Boolean(source.versionPostedOn && source.versionPostedOn < row.occurredOn),
        },
        termHits: hits.map((hit) => ({
          label: hit.label,
          match: hit.match,
          snippet: applicabilitySnippet(source.text!, hit),
        })),
      });
    }

    memberEvents.push({
      ...row,
      status: candidates.length ? 'candidate_for_semantic_review' : 'not_applicable',
      reason: candidates.length ? 'deterministic_issue_match_only' : 'bill_issue_not_nominated',
      candidateClaimIds: candidates,
    });
  }

  const statusCounts = Object.fromEntries(
    [...new Set(memberEvents.map((row) => String(row.status)))].sort()
      .map((status) => [status, memberEvents.filter((row) => row.status === status).length]),
  );
  const sourceStatusCounts = Object.fromEntries(
    [...new Set([...eventSources.values()].map((row) => row.status))].sort()
      .map((status) => [status, [...eventSources.values()].filter((row) => row.status === status).length]),
  );
  const candidateMemberEvents = memberEvents.filter((row) => row.status === 'candidate_for_semantic_review');
  const output = {
    schemaVersion: 'historical-density-p2-applicability-candidate-audit-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenInputs: {
      targetUniverseArtifactId: 11252079484,
      targetUniverseArtifactDigest: 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
      p2ReviewArtifactId: 11383404277,
      p2ReviewArtifactDigest: 'sha256:bc0c274ecc7705a47dda26f97d2f2c0a09643ac77b0a585ed63e0402ee4bd51c',
      p2ReviewIntegritySha256: EXPECTED_COHORT_INTEGRITY,
    },
    cohort: {
      rawMemberEventRows: targetRows.length,
      eligibleMemberEventRows: eligibleRows.length,
      excludedBeforeAnyFrozenSourceAvailability: targetRows.length - eligibleRows.length,
      uniqueEvents: events.length,
      uniqueBills: new Set(eligibleRows.map((row) => row.billId)).size,
      memberships: new Set(eligibleRows.map((row) => row.membershipId)).size,
      directionalSemanticGroups: claims.length,
      directionalDocuments: claims.reduce((count, claim) => count + claim.sourceRows.length, 0),
      screenableSemanticGroups: claims.filter((claim) => claim.screenPolicy === 'screen_issue_match').length,
      genericRejectedSemanticGroups: claims.filter((claim) => claim.screenPolicy === 'reject_claim_too_generic').length,
    },
    sourceVerification: {
      events: eventSources.size,
      statusCounts: sourceStatusCounts,
      strictRule: 'latest exact official Revisor bill version with postedOn < target vote date',
      currentBillTitleUsed: false,
      sameDayVersionEligible: false,
    },
    candidateScreen: {
      memberEventStatusCounts: statusCounts,
      candidateMemberEvents: candidateMemberEvents.length,
      candidateClaimPairs: candidateClaims.length,
      candidateBills: new Set(candidateClaims.map((row) => row.billId)).size,
      candidateMemberships: new Set(candidateClaims.map((row) => row.membershipId)).size,
      automaticApplicableRows: 0,
      automaticAlignmentRows: 0,
      nextStep: 'semantic review of candidate claim pairs against exact pre-vote bill text; mixed/omnibus/unclear direction fails closed',
    },
    claimRules: claims.map((claim) => ({
      id: claim.id,
      membershipId: claim.membershipId,
      memberName: claim.memberName,
      sourceRows: claim.sourceRows,
      availableAt: claim.availableAt,
      stance: claim.stance,
      normalizedClaim: claim.normalizedClaim,
      issueFamily: claim.issueFamily,
      screenPolicy: claim.screenPolicy,
      candidatePatternLabels: claim.candidatePatterns.map((pattern) => pattern.label),
      conservativeReason: claim.conservativeReason ?? null,
    })),
    candidateClaims,
    memberEvents,
    policy: {
      outcomeUse: 'none',
      inputTargetRowsContainOutcomes: false,
      sourceDiscovery: 'official Minnesota Revisor only',
      sourceBodiesFetched: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      billIdentifiersInferredFromMemberClaims: false,
      currentMutableBillTitleUsed: false,
      currentCompanionMetadataUsed: false,
      sameDayBillVersionsExcluded: true,
      deterministicScreenCanDeclareApplicability: false,
      semanticReviewRequiredForApplicability: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const outputDir = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_OUTPUT_DIR');
  mkdirSync(outputDir, { recursive: true });
  const canonicalWithoutSha = JSON.stringify(output, null, 2) + '\n';
  output.contentSha256WithoutSelfField = createHash('sha256').update(canonicalWithoutSha).digest('hex');
  const finalText = JSON.stringify(output, null, 2) + '\n';
  writeFileSync(resolve(outputDir, OUTPUT_FILE), finalText);

  console.log(JSON.stringify({
    historicalDensityP2ApplicabilityCandidateAudit: {
      eligibleMemberEventRows: eligibleRows.length,
      events: events.length,
      candidateMemberEvents: candidateMemberEvents.length,
      candidateClaimPairs: candidateClaims.length,
      sourceStatusCounts,
      automaticApplicableRows: 0,
      outcomeUse: 'none',
      vercelUsed: false,
      servingChanged: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
