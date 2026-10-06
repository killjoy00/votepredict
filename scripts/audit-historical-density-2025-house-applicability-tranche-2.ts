import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';
import { historicalBillIdentityTitle } from '../src/evaluation/historical-quick-replay.js';

const SESSION = '2025-2026';
const SEMANTIC_RUN_ID = 37532945502;
const SEMANTIC_ARTIFACT_ID = 11445241994;
const SEMANTIC_DIGEST =
  'sha256:80429ab79b4ab973d76fdd2fbdec5e8c55091a5c7873c96dad066a004a22cfce';
const TARGET_EVENT_KEY_SHA =
  '9304a46f37889fa3ae166803e3675669c55fb99d475f1484ea3efd11f7e01299';
const TARGET_SOURCE_ARTIFACT_ID = 11436413885;
const TARGET_SOURCE_ARTIFACT_DIGEST =
  'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44';
const EXPECTED_GROUPS = 46;
const EXPECTED_EVENTS = 25;
const OUTPUT_FILE =
  'historical-density-2025-house-applicability-candidate-audit-tranche-2-v1.json';

type SemanticGroup = {
  semanticKey: string;
  publicMemberKey: string;
  lrlId: string;
  memberName: string;
  sourceRows: number[];
  sourceUrls: string[];
  earliestAvailability: string;
  topics: string[];
  claimType: string;
  stance: 'supports' | 'opposes';
  explicitness: string;
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
  linkage: 'member_issue';
  candidateBillIdentifiers: string[];
  crossBatchDuplicateOf: string[];
  novelForApplicabilityScreen: boolean;
  internalMembershipIdentityResolved: boolean;
};

type SemanticReview = {
  schemaVersion: string;
  batchId: string;
  issue: number;
  session: string;
  summary: {
    documents: number;
    directionalDocuments: number;
    nonDirectionalDocuments: number;
    uniqueSemanticGroups: number;
    novelSemanticGroups: number;
    candidateBillIdentifiers: number;
    internalMembershipIdentitiesResolved: number;
  };
  semanticGroups: SemanticGroup[];
  policy: Record<string, unknown>;
};

type TargetEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  chamber: string;
  uncoveredRows: number;
  uncoveredMemberships: number;
};

type TargetTranche = {
  schemaVersion: string;
  issue: number;
  session: string;
  chamber: string;
  source: {
    artifactId: number;
    artifactDigest: string;
    matrixGzipSha256: string;
    matrixCanonicalNdjsonSha256: string;
    targetRowKeySha256: string;
  };
  ranking: {
    trancheIndex: number;
    rankStart: number;
    rankEnd: number;
    eventCount: number;
    eventKeySha256: string;
    priorTrancheEventKeySha256: string;
  };
  events: TargetEvent[];
  identifiers: string[];
  minTargetDate: string;
  maxTargetDate: string;
  policy: Record<string, unknown>;
};

type EventSource = {
  voteEventId: string;
  identifier: string;
  billId: string;
  occurredOn: string;
  status:
    | 'verified'
    | 'no_strict_prevote_version'
    | 'status_fetch_failed'
    | 'version_fetch_failed';
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

const TOPIC_ALIASES: Record<string, string[]> = {
  'hazardous chemicals': ['hazardous chemical', 'chemical release'],
  refineries: ['refinery', 'refineries'],
  'electric vehicles': ['electric vehicle', 'electric vehicles', 'ev registration'],
  telework: ['telework', 'remote work'],
  lobbying: ['lobbyist', 'lobbying'],
  'duty to retreat': ['duty to retreat'],
  pfas: ['pfas', 'perfluoroalkyl', 'polyfluoroalkyl'],
  zoning: ['zoning'],
  abortion: ['abortion', 'unborn'],
  'nuclear energy': ['nuclear'],
  'parental rights': ['parental rights', 'parent rights', 'parents'],
  'school sports': ['school sports', 'interscholastic', 'athletics'],
  'transgender policy': ['transgender', 'gender identity', 'biological sex'],
  'transgender rights': ['transgender', 'gender identity'],
  antitrust: ['antitrust', 'monopoly', 'monopsony'],
  'human trafficking': ['human trafficking', 'trafficking'],
  'fraud prevention': ['fraud', 'fraudulent'],
  'government oversight': ['inspector general', 'oversight', 'accountability'],
  'education funding': ['education funding', 'special education', 'pupil aid', 'teacher compensation'],
  medicaid: ['medicaid', 'medical assistance'],
  'paid family leave': ['paid family', 'family and medical leave', 'paid leave'],
  dwi: ['dwi', 'driving while impaired', 'ignition interlock'],
  'ignition interlock': ['ignition interlock', 'interlock'],
  'traffic stops': ['traffic stop', 'traffic stops'],
  'racial profiling': ['racial profiling'],
  'civil rights': ['civil rights', 'civil liberties'],
  'lgbtq rights': ['lgbtq', 'sexual orientation', 'gender identity'],
  immigration: ['immigration', 'immigrant'],
  'disability rights': ['disability', 'disabled'],
  'teacher pensions': ['teacher pension', 'teacher retirement'],
  'earned sick time': ['earned sick', 'sick time'],
  tolls: ['toll', 'ez pass', 'e-zpass'],
  'off-highway vehicles': ['off-highway', 'snowmobile', 'all-terrain vehicle'],
  'gun violence': ['gun violence', 'firearm violence'],
  'manufactured homes': ['manufactured home', 'mobile home'],
  rent: ['rent increase', 'rent'],
  'emergency powers': ['emergency powers', 'emergency authority'],
};

const GENERIC_TOKENS = new Set([
  'public','state','government','policy','policies','rights','support','supports',
  'opposes','protecting','education','healthcare','health','labor','school',
  'schools','funding','safety','community','communities','minnesota','program',
  'programs','access','law','laws','family','medical','civil','criminal',
  'transportation','environment','affordability','accountability',
]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.stack ?? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1200);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function topicPatterns(group: SemanticGroup): string[] {
  const patterns: string[] = [];
  for (const raw of group.topics) {
    const topic = normalize(raw);
    if (!topic) continue;
    patterns.push(topic);
    for (const alias of TOPIC_ALIASES[topic] ?? []) patterns.push(normalize(alias));
  }
  const topicTokens = group.topics
    .flatMap((topic) => normalize(topic).split(' '))
    .filter((token) => token.length >= 5 && !GENERIC_TOKENS.has(token));
  for (const token of topicTokens) patterns.push(token);
  return unique(patterns).filter((pattern) => pattern.length >= 4);
}

function nominate(text: string, group: SemanticGroup) {
  const normalized = normalize(text);
  const patterns = topicPatterns(group);
  const hits = patterns.filter((pattern) => normalized.includes(pattern));
  const multiword = hits.filter((hit) => hit.includes(' '));
  const distinctTokens = unique(
    hits.flatMap((hit) => hit.split(' ')).filter((token) => token.length >= 5),
  );
  const nominated = multiword.length > 0 || distinctTokens.length >= 2
    || hits.some((hit) => /^(pfas|medicaid|zoning|abortion|telework|antitrust|lobbyist|lobbying|nuclear|dwi)$/.test(hit));
  return { nominated, hits };
}

function snippet(text: string, pattern: string): string {
  const normalizedText = normalize(text);
  const index = normalizedText.indexOf(pattern);
  if (index < 0) return '';
  const start = Math.max(0, index - 180);
  return normalizedText.slice(start, Math.min(normalizedText.length, index + pattern.length + 260));
}

function selectStrictPreVoteVersion(
  metadata: RevisorBillMetadata,
  occurredOn: string,
): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn < occurredOn)
    .sort((a, b) =>
      b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal,
    )[0];
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 700 * attempt),
        );
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

async function materializeEventSources(
  events: readonly TargetEvent[],
): Promise<Map<string, EventSource>> {
  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>
  >();

  const rows = await mapLimit<TargetEvent, readonly [string, EventSource]>(
    [...events].sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId),
    ),
    4,
    async (event) => {
      let metadata: RevisorBillMetadata;
      try {
        let pending = statusCache.get(event.identifier);
        if (!pending) {
          pending = retry(() => fetchRevisorBill(SESSION, event.identifier, false));
          statusCache.set(event.identifier, pending);
        }
        metadata = await pending;
      } catch (error) {
        return [event.voteEventId, {
          voteEventId: event.voteEventId,
          identifier: event.identifier,
          billId: event.billId,
          occurredOn: event.occurredOn,
          status: 'status_fetch_failed',
          error: safeMessage(error),
        }] as const;
      }

      const selected = selectStrictPreVoteVersion(metadata, event.occurredOn);
      if (!selected) {
        return [event.voteEventId, {
          voteEventId: event.voteEventId,
          identifier: event.identifier,
          billId: event.billId,
          occurredOn: event.occurredOn,
          status: 'no_strict_prevote_version',
          statusUrl: metadata.sourceUrl,
        }] as const;
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
          identifier: event.identifier,
          billId: event.billId,
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
        }] as const;
      } catch (error) {
        return [event.voteEventId, {
          voteEventId: event.voteEventId,
          identifier: event.identifier,
          billId: event.billId,
          occurredOn: event.occurredOn,
          status: 'version_fetch_failed',
          statusUrl: metadata.sourceUrl,
          versionUrl: selected.textUrl,
          versionPostedOn: selected.postedOn,
          versionOrdinal: selected.ordinal,
          versionKey: selected.versionKey,
          error: safeMessage(error),
        }] as const;
      }
    },
  );
  return new Map(rows);
}

async function main() {
  const semantic = JSON.parse(
    readFileSync(requiredEnv('VOTEPREDICT_2025_HOUSE_SEMANTIC_REVIEW_PATH'), 'utf8'),
  ) as SemanticReview;
  const targetTranche = JSON.parse(
    readFileSync(requiredEnv('VOTEPREDICT_2025_HOUSE_TARGET_TRANCHE_PATH'), 'utf8'),
  ) as TargetTranche;

  if (
    semantic.schemaVersion !== 'historical-density-2025-house-semantic-review-v1'
    || semantic.batchId !== 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-001'
    || semantic.issue !== 718
    || semantic.session !== SESSION
    || semantic.summary.directionalDocuments !== 46
    || semantic.summary.nonDirectionalDocuments !== 4
    || semantic.summary.uniqueSemanticGroups !== EXPECTED_GROUPS
    || semantic.summary.novelSemanticGroups !== EXPECTED_GROUPS
    || semantic.summary.candidateBillIdentifiers !== 0
    || semantic.summary.internalMembershipIdentitiesResolved !== 0
    || semantic.semanticGroups.length !== EXPECTED_GROUPS
    || semantic.semanticGroups.some((group) =>
      !group.novelForApplicabilityScreen
      || group.linkage !== 'member_issue'
      || group.candidateBillIdentifiers.length !== 0
      || group.internalMembershipIdentityResolved
      || group.crossBatchDuplicateOf.length !== 0
    )
    || semantic.policy.outcomeUse !== 'none'
    || semantic.policy.billInference !== false
    || semantic.policy.targetBillApplicabilityInferred !== false
    || semantic.policy.productionDatabaseQueried !== false
    || semantic.policy.vercelUsed !== false
    || semantic.policy.modelFitting !== 'none'
  ) {
    throw new Error('2025 House semantic-review identity/policy drifted');
  }

  if (
    targetTranche.schemaVersion !== 'historical-density-2025-house-target-tranche-v1'
    || targetTranche.issue !== 718
    || targetTranche.session !== SESSION
    || targetTranche.chamber !== 'house'
    || targetTranche.source.artifactId !== TARGET_SOURCE_ARTIFACT_ID
    || targetTranche.source.artifactDigest !== TARGET_SOURCE_ARTIFACT_DIGEST
    || targetTranche.ranking.trancheIndex !== 2
    || targetTranche.ranking.rankStart !== 26
    || targetTranche.ranking.rankEnd !== 50
    || targetTranche.ranking.eventCount !== EXPECTED_EVENTS
    || targetTranche.ranking.eventKeySha256 !== TARGET_EVENT_KEY_SHA
    || targetTranche.ranking.priorTrancheEventKeySha256
      !== 'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811'
    || targetTranche.events.length !== EXPECTED_EVENTS
    || targetTranche.minTargetDate !== '2025-04-10'
    || targetTranche.maxTargetDate !== '2025-04-30'
    || targetTranche.policy.targetVoteOutcomesRead !== false
    || targetTranche.policy.outcomeUse !== 'none'
    || targetTranche.policy.productionDatabaseQueried !== false
    || targetTranche.policy.productionWrites !== false
    || targetTranche.policy.vercelUsed !== false
    || targetTranche.policy.applicabilityInferred !== false
    || targetTranche.policy.sameDayEligible !== false
  ) {
    throw new Error('2025 House tranche-2 target identity/policy drifted');
  }

  const eventSources = await materializeEventSources(targetTranche.events);
  const pairResults: Array<Record<string, unknown>> = [];
  const candidateClaims: Array<Record<string, unknown>> = [];

  for (const group of semantic.semanticGroups) {
    for (const event of targetTranche.events) {
      if (!(group.earliestAvailability < event.occurredOn)) continue;
      const source = eventSources.get(event.voteEventId);
      if (!source) throw new Error(`Missing event source ${event.voteEventId}`);

      if (source.status !== 'verified' || !source.text) {
        pairResults.push({
          semanticKey: group.semanticKey,
          publicMemberKey: group.publicMemberKey,
          voteEventId: event.voteEventId,
          identifier: event.identifier,
          occurredOn: event.occurredOn,
          status: 'ambiguous_fail_closed',
          reason: source.status,
        });
        continue;
      }

      const screen = nominate(source.text, group);
      if (!screen.nominated) {
        pairResults.push({
          semanticKey: group.semanticKey,
          publicMemberKey: group.publicMemberKey,
          voteEventId: event.voteEventId,
          identifier: event.identifier,
          occurredOn: event.occurredOn,
          status: 'not_nominated',
          reason: 'no_conservative_topic_overlap',
        });
        continue;
      }

      const reviewKey =
        `${group.semanticKey}|${event.identifier}|${event.occurredOn}|${source.versionSha256}`;
      pairResults.push({
        semanticKey: group.semanticKey,
        publicMemberKey: group.publicMemberKey,
        voteEventId: event.voteEventId,
        identifier: event.identifier,
        occurredOn: event.occurredOn,
        status: 'candidate_for_semantic_review',
        reviewKey,
      });
      candidateClaims.push({
        reviewKey,
        semanticKey: group.semanticKey,
        publicMemberKey: group.publicMemberKey,
        lrlId: group.lrlId,
        memberName: group.memberName,
        sourceRows: group.sourceRows,
        sourceUrls: group.sourceUrls,
        claimAvailableAt: group.earliestAvailability,
        memberStance: group.stance,
        normalizedClaim: group.normalizedClaim,
        topics: group.topics,
        claimType: group.claimType,
        explicitness: group.explicitness,
        extractionConfidence: group.extractionConfidence,
        voteEventId: event.voteEventId,
        billId: event.billId,
        identifier: event.identifier,
        chamber: event.chamber,
        occurredOn: event.occurredOn,
        candidateOnly: true,
        applicabilityDecision: 'pending_semantic_review',
        billPolicyDirection: 'not_inferred_by_candidate_screen',
        alignmentDirection: 'not_inferred_by_candidate_screen',
        internalMembershipIdentityResolved: false,
        versionProof: {
          statusUrl: source.statusUrl,
          versionUrl: source.versionUrl,
          postedOn: source.versionPostedOn,
          ordinal: source.versionOrdinal,
          versionKey: source.versionKey,
          textSha256: source.versionSha256,
          identityTitle: source.identityTitle,
          strictlyBeforeVoteDate: Boolean(
            source.versionPostedOn
            && source.versionPostedOn < event.occurredOn
          ),
        },
        nominationHits: screen.hits.map((pattern) => ({
          pattern,
          snippet: snippet(source.text!, pattern),
        })),
      });
    }
  }

  const sourceStatusCounts = Object.fromEntries(
    unique([...eventSources.values()].map((row) => row.status))
      .sort()
      .map((status) => [
        status,
        [...eventSources.values()].filter((row) => row.status === status).length,
      ]),
  );
  const pairStatusCounts = Object.fromEntries(
    unique(pairResults.map((row) => String(row.status)))
      .sort()
      .map((status) => [
        status,
        pairResults.filter((row) => row.status === status).length,
      ]),
  );

  const report = {
    schemaVersion:
      'historical-density-2025-house-applicability-candidate-audit-tranche-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: SESSION,
    frozenInputs: {
      semanticReviewRunId: SEMANTIC_RUN_ID,
      semanticReviewArtifactId: SEMANTIC_ARTIFACT_ID,
      semanticReviewArtifactDigest: SEMANTIC_DIGEST,
      targetSourceArtifactId: TARGET_SOURCE_ARTIFACT_ID,
      targetSourceArtifactDigest: TARGET_SOURCE_ARTIFACT_DIGEST,
      targetTrancheIndex: 2,
      targetRankStart: 26,
      targetRankEnd: 50,
      targetEventKeySha256: TARGET_EVENT_KEY_SHA,
    },
    cohort: {
      novelSemanticGroups: semantic.semanticGroups.length,
      targetEvents: targetTranche.events.length,
      eligibleClaimEventPairs: pairResults.length,
      publicMembers: new Set(
        semantic.semanticGroups.map((group) => group.publicMemberKey),
      ).size,
      internalMembershipIdentitiesResolved: 0,
    },
    sourceVerification: {
      events: eventSources.size,
      statusCounts: sourceStatusCounts,
      strictRule:
        'latest exact official Revisor bill version with postedOn < target vote date',
      sameDayVersionEligible: false,
      currentMutableBillTitleUsed: false,
    },
    candidateScreen: {
      pairStatusCounts,
      candidateClaimPairs: candidateClaims.length,
      candidateReviewGroups: new Set(
        candidateClaims.map((row) => row.reviewKey),
      ).size,
      candidateBills: new Set(
        candidateClaims.map((row) => row.billId),
      ).size,
      candidatePublicMembers: new Set(
        candidateClaims.map((row) => row.publicMemberKey),
      ).size,
      candidateSemanticGroups: new Set(
        candidateClaims.map((row) => row.semanticKey),
      ).size,
      automaticApplicableRows: 0,
      automaticAlignmentRows: 0,
      nextStep:
        'manual semantic review against exact strict-pre-vote bill text; mixed, omnibus, incidental, or unclear policy fails closed',
    },
    candidateClaims,
    pairResults,
    policy: {
      outcomeUse: 'none',
      targetVoteOutcomesRead: false,
      sourceDiscovery: 'official Minnesota Revisor only',
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      publicLrlIdentityOnly: true,
      internalMembershipIdentityResolved: false,
      internalIdentityRequiredBeforeFeatureIntegration: true,
      billIdentifiersInferredFromMemberClaims: false,
      sameDayBillVersionsExcluded: true,
      deterministicScreenCanDeclareApplicability: false,
      semanticReviewRequiredForApplicability: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const outputDir = requiredEnv(
    'VOTEPREDICT_2025_HOUSE_APPLICABILITY_OUTPUT_DIR',
  );
  mkdirSync(outputDir, { recursive: true });
  const canonical = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonical)
    .digest('hex');
  writeFileSync(
    resolve(outputDir, OUTPUT_FILE),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );

  console.log(JSON.stringify({
    historicalDensity2025HouseApplicabilityCandidateAuditTranche2: {
      novelSemanticGroups: semantic.semanticGroups.length,
      targetEvents: targetTranche.events.length,
      eligibleClaimEventPairs: pairResults.length,
      sourceStatusCounts,
      candidateClaimPairs: candidateClaims.length,
      candidateBills: new Set(candidateClaims.map((row) => row.billId)).size,
      candidatePublicMembers: new Set(candidateClaims.map((row) => row.publicMemberKey)).size,
      candidateSemanticGroups: new Set(candidateClaims.map((row) => row.semanticKey)).size,
      automaticApplicableRows: 0,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
