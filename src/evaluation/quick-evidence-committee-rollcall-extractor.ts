import { createHash } from 'node:crypto';
import { HISTORICAL_DEEP_PILOT_CASES } from './historical-deep-pilot';
import type {
  HistoricalDeepDiscoveryCase,
  HistoricalDeepDiscoveryManifest,
} from './historical-deep-discovery';
import {
  extractHistoricalDeepDiscoveryCandidates,
  historicalHtmlLines,
} from './historical-deep-discovery-extractor';
import {
  HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
  HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
  type HistoricalDeepSourceBundle,
} from './historical-deep-source-catalog';
import {
  buildPageAliases,
  findExpandedRollCalls,
  HISTORICAL_DEEP_EXPANSION_PARSER_V2,
  resolveVoteName,
  type ExtractionRule,
} from './historical-deep-expansion-extractor-v2';
import {
  classifyMotion,
  HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY,
  type HistoricalDeepProceduralMechanic,
} from './historical-deep-procedural-mechanics';
import type {
  QuickEvidenceCommitteeRollcallManifest,
  QuickEvidenceCommitteeRollcallManifestCase,
} from './quick-evidence-committee-rollcall-manifest';
import type {
  QuickEvidenceCommitteeRollcallCollectedSource,
  QuickEvidenceCommitteeRollcallSourceBundle,
  QuickEvidenceCommitteeRollcallSourceMatch,
} from './quick-evidence-committee-rollcall-source-bundle';

export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CANDIDATE_SCHEMA =
  'quick-evidence-committee-rollcall-candidates-v1' as const;

export type QuickEvidenceCommitteeRollcallFeatureName =
  | 'committeeRecommendsPassageAye'
  | 'committeeRecommendsPassageNay'
  | 'advancesTowardFloorEligibilityAye'
  | 'advancesTowardFloorEligibilityNay'
  | 'continuesCommitteeReviewAye'
  | 'continuesCommitteeReviewNay'
  | 'impedesCurrentBillProgressAye'
  | 'impedesCurrentBillProgressNay'
  | 'defersCurrentBillActionAye'
  | 'defersCurrentBillActionNay'
  | 'unclassifiedCommitteeMotionAye'
  | 'unclassifiedCommitteeMotionNay';

export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES: readonly QuickEvidenceCommitteeRollcallFeatureName[] = [
  'committeeRecommendsPassageAye',
  'committeeRecommendsPassageNay',
  'advancesTowardFloorEligibilityAye',
  'advancesTowardFloorEligibilityNay',
  'continuesCommitteeReviewAye',
  'continuesCommitteeReviewNay',
  'impedesCurrentBillProgressAye',
  'impedesCurrentBillProgressNay',
  'defersCurrentBillActionAye',
  'defersCurrentBillActionNay',
  'unclassifiedCommitteeMotionAye',
  'unclassifiedCommitteeMotionNay',
] as const;

export interface QuickEvidenceCommitteeRollcallObservation {
  stableKey: string;
  voteEventId: string;
  identifier: string;
  session: string;
  partition: QuickEvidenceCommitteeRollcallManifestCase['partition'];
  occurredOn: string;
  asOf: string;
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  district?: string;
  quickYesProbability?: number;
  voteSide: 'aye' | 'nay';
  motionText: string;
  excerpt: string;
  extractionRule: ExtractionRule;
  mechanics: HistoricalDeepProceduralMechanic[];
  source: {
    sourceId: string;
    title: string;
    url: string;
    publishedAt: string;
    contentSha256: string;
  };
  mechanicallyActionable: false;
  finalPassageInference: 'none';
}

export interface QuickEvidenceCommitteeRollcallFeatureRow {
  stableKey: string;
  voteEventId: string;
  identifier: string;
  session: string;
  partition: QuickEvidenceCommitteeRollcallManifestCase['partition'];
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  quickYesProbability?: number;
  features: Record<QuickEvidenceCommitteeRollcallFeatureName, number>;
}

export interface QuickEvidenceCommitteeRollcallDiagnostic {
  sourceId: string;
  voteEventId: string;
  identifier: string;
  type: 'no_named_bill_roll_call' | 'unresolved_vote_name' | 'ambiguous_vote_name';
  rawName?: string;
  detail: string;
}

export interface QuickEvidenceCommitteeRollcallCandidateArtifact {
  schemaVersion: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CANDIDATE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    parser: typeof HISTORICAL_DEEP_EXPANSION_PARSER_V2;
    baselineParser: 'deterministic-house-committee-roll-call-v1';
    mechanicsPolicy: typeof HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY;
    sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1';
    outcomeUse: 'none';
    probabilityAction: 'none';
    designGuard: string;
  };
  input: {
    manifestCases: number;
    manifestMemberCasePairs: number;
    sourcePages: number;
    sourceCaseMatches: number;
  };
  summary: {
    observations: number;
    baselineObservations: number;
    supplementalObservations: number;
    memberEventPairsWithFeatures: number;
    eventsWithFeatures: number;
    sourcesWithFeatures: number;
    ayeObservations: number;
    nayObservations: number;
    observationsWithMultipleMechanics: number;
    unclassifiedObservations: number;
    bySession: Record<string, {
      observations: number;
      memberEventPairsWithFeatures: number;
      eventsWithFeatures: number;
    }>;
  };
  observations: QuickEvidenceCommitteeRollcallObservation[];
  featureRows: QuickEvidenceCommitteeRollcallFeatureRow[];
  diagnostics: QuickEvidenceCommitteeRollcallDiagnostic[];
}

function adaptCase(value: QuickEvidenceCommitteeRollcallManifestCase): HistoricalDeepDiscoveryCase {
  const members = value.members.map((member) => ({
    membershipId: member.membershipId,
    legislatorId: member.legislatorId,
    memberName: member.memberName,
    district: member.district,
    party: member.party,
    title: member.title,
    yesProbability: member.yesProbability,
    cannotPredictReason: member.cannotPredictReason,
    evidenceQuality: member.evidenceQuality,
    support: member.support,
    selectedForCurrentDeep: false,
  }));
  return {
    voteEventId: value.voteEventId,
    billId: value.billId,
    identifier: value.identifier,
    title: value.title,
    session: value.session,
    chamberId: value.chamberId,
    chamber: value.chamber,
    occurredOn: value.occurredOn,
    asOf: value.asOf,
    targetVersionId: value.targetVersionId,
    quickModelVersion: value.quickModelVersion,
    members,
    currentDeepTargetIds: [],
    discoveryRequest: {
      forecastId: value.voteEventId,
      billId: value.billId,
      chamberId: value.chamberId,
      asOf: value.asOf,
      subject: { identifier: value.identifier, title: value.title },
      targets: members.map((member) => ({
        membershipId: member.membershipId,
        memberName: member.memberName,
        party: member.party,
        district: member.district,
        yesProbability: member.yesProbability,
        rationale: 'Outcome-blind broad committee-rollcall parser adapter.',
      })),
    },
  };
}

function singleCaseDiscovery(
  manifest: QuickEvidenceCommitteeRollcallManifest,
  value: QuickEvidenceCommitteeRollcallManifestCase,
): HistoricalDeepDiscoveryManifest {
  return {
    metadata: {
      generatedAt: manifest.generatedAt,
      codeSha: manifest.metadata.codeSha,
      databaseSource: manifest.metadata.databaseSource,
      purpose: 'single-case adapter for the frozen deterministic committee roll-call parser',
      pilotCases: HISTORICAL_DEEP_PILOT_CASES,
      cases: 1,
      memberCasePairs: value.members.length,
      currentDeepTargetLimit: 0,
    },
    cases: [adaptCase(value)],
  };
}

function singleCaseSourceBundle(
  source: QuickEvidenceCommitteeRollcallCollectedSource,
  match: QuickEvidenceCommitteeRollcallSourceMatch,
): HistoricalDeepSourceBundle {
  return {
    schemaVersion: HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
    catalogSchemaVersion: HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
    jurisdictionSlug: 'us-mn',
    generatedAt: source.fetchedAt,
    sourceCount: 1,
    caseCount: 1,
    sources: [{
      case: {
        session: source.session,
        chamber: 'house',
        identifier: match.identifier,
        occurredOn: match.occurredOn,
      },
      id: source.id,
      sourceClass: source.sourceClass,
      url: source.url,
      title: source.title,
      publishedAt: source.publishedAt,
      expectedMarkers: source.expectedMarkers,
      fetchedAt: source.fetchedAt,
      finalUrl: source.finalUrl,
      httpStatus: source.httpStatus,
      contentType: source.contentType,
      bytes: source.bytes,
      contentSha256: source.contentSha256,
      content: source.content,
    }],
  };
}

function verifyInputs(
  manifest: QuickEvidenceCommitteeRollcallManifest,
  sources: QuickEvidenceCommitteeRollcallSourceBundle,
): Map<string, QuickEvidenceCommitteeRollcallManifestCase> {
  if (manifest.schemaVersion !== 'quick-evidence-committee-rollcall-manifest-v1') {
    throw new Error(`Unsupported committee-rollcall manifest schema: ${String(manifest.schemaVersion)}`);
  }
  if (sources.schemaVersion !== 'quick-evidence-committee-rollcall-source-bundle-v1') {
    throw new Error(`Unsupported committee-rollcall source schema: ${String(sources.schemaVersion)}`);
  }
  if (sources.metadata.sourcePlan !== 'quick-evidence-committee-rollcall-screen-plan-v1') {
    throw new Error(`Unexpected committee-rollcall source plan: ${String(sources.metadata.sourcePlan)}`);
  }
  if (sources.metadata.manifestGeneratedAt !== manifest.generatedAt) {
    throw new Error('Committee-rollcall source bundle does not reference this manifest generation');
  }
  if (sources.metadata.manifestCodeSha !== manifest.metadata.codeSha) {
    throw new Error('Committee-rollcall source bundle manifest code SHA mismatch');
  }

  const byVoteId = new Map(manifest.cases.map((item) => [item.voteEventId, item]));
  if (byVoteId.size !== manifest.cases.length) throw new Error('Committee-rollcall manifest has duplicate vote event IDs');
  for (const source of sources.sources) {
    const actualHash = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
    if (actualHash !== source.contentSha256) {
      throw new Error(`Committee-rollcall source hash mismatch for ${source.id}`);
    }
    for (const match of source.matchedCases) {
      const item = byVoteId.get(match.voteEventId);
      if (!item) throw new Error(`Committee-rollcall source ${source.id} targets unknown event ${match.voteEventId}`);
      if (
        item.stableKey !== match.stableKey
        || item.externalKey !== match.externalKey
        || item.identifier !== match.identifier
        || item.occurredOn !== match.occurredOn
        || item.partition !== match.partition
      ) throw new Error(`Committee-rollcall source ${source.id} lineage mismatch for ${match.voteEventId}`);
      if (source.indexDate >= item.occurredOn) {
        throw new Error(`Committee-rollcall source ${source.id} is not strictly pre-vote for ${item.stableKey}`);
      }
    }
  }
  return byVoteId;
}

function adaptedExpansionMembers(value: QuickEvidenceCommitteeRollcallManifestCase) {
  return value.members.map((member) => ({
    ...member,
    selectedForCurrentDeep: false,
    selectedForCandidateDeep: false,
  }));
}

function observationKey(value: Pick<
  QuickEvidenceCommitteeRollcallObservation,
  'voteEventId' | 'membershipId' | 'voteSide' | 'motionText' | 'source'
>): string {
  return [value.voteEventId, value.source.sourceId, value.motionText, value.membershipId, value.voteSide].join('|');
}

function mechanicFeature(
  mechanic: HistoricalDeepProceduralMechanic | undefined,
  voteSide: 'aye' | 'nay',
): QuickEvidenceCommitteeRollcallFeatureName {
  const suffix = voteSide === 'aye' ? 'Aye' : 'Nay';
  const prefix = mechanic === 'committee_recommends_passage'
    ? 'committeeRecommendsPassage'
    : mechanic === 'advances_toward_floor_eligibility'
      ? 'advancesTowardFloorEligibility'
      : mechanic === 'continues_committee_review'
        ? 'continuesCommitteeReview'
        : mechanic === 'impedes_current_bill_progress'
          ? 'impedesCurrentBillProgress'
          : mechanic === 'defers_current_bill_action'
            ? 'defersCurrentBillAction'
            : 'unclassifiedCommitteeMotion';
  return `${prefix}${suffix}` as QuickEvidenceCommitteeRollcallFeatureName;
}

function emptyFeatures(): Record<QuickEvidenceCommitteeRollcallFeatureName, number> {
  return Object.fromEntries(
    QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.map((name) => [name, 0]),
  ) as Record<QuickEvidenceCommitteeRollcallFeatureName, number>;
}

export function extractQuickEvidenceCommitteeRollcallCandidates(
  manifest: QuickEvidenceCommitteeRollcallManifest,
  sources: QuickEvidenceCommitteeRollcallSourceBundle,
  generatedAt = new Date().toISOString(),
): QuickEvidenceCommitteeRollcallCandidateArtifact {
  const caseByVoteId = verifyInputs(manifest, sources);
  const observations: QuickEvidenceCommitteeRollcallObservation[] = [];
  const diagnostics: QuickEvidenceCommitteeRollcallDiagnostic[] = [];
  const dedupe = new Set<string>();
  let baselineObservations = 0;
  let supplementalObservations = 0;

  const addObservation = (
    value: QuickEvidenceCommitteeRollcallObservation,
    sourceKind: 'baseline' | 'supplemental',
  ) => {
    const key = observationKey(value);
    if (dedupe.has(key)) return;
    dedupe.add(key);
    observations.push(value);
    if (sourceKind === 'baseline') baselineObservations += 1;
    else supplementalObservations += 1;
  };

  for (const source of sources.sources) {
    const lines = historicalHtmlLines(source.content);
    for (const match of source.matchedCases) {
      const target = caseByVoteId.get(match.voteEventId);
      if (!target) throw new Error(`Missing committee-rollcall target ${match.voteEventId}`);

      const baseline = extractHistoricalDeepDiscoveryCandidates(
        singleCaseDiscovery(manifest, target),
        singleCaseSourceBundle(source, match),
        generatedAt,
      );
      for (const diagnostic of baseline.diagnostics) {
        diagnostics.push({
          sourceId: source.id,
          voteEventId: target.voteEventId,
          identifier: target.identifier,
          type: diagnostic.type === 'no_bill_procedural_roll_call'
            ? 'no_named_bill_roll_call'
            : diagnostic.type,
          rawName: diagnostic.rawName,
          detail: diagnostic.detail,
        });
      }
      for (const candidate of baseline.candidates) {
        addObservation({
          stableKey: target.stableKey,
          voteEventId: target.voteEventId,
          identifier: target.identifier,
          session: target.session,
          partition: target.partition,
          occurredOn: target.occurredOn,
          asOf: target.asOf,
          membershipId: candidate.membershipId,
          legislatorId: candidate.legislatorId,
          memberName: candidate.memberName,
          party: candidate.party,
          district: candidate.district,
          quickYesProbability: candidate.quickYesProbability,
          voteSide: candidate.voteSide,
          motionText: candidate.motionText,
          excerpt: candidate.excerpt,
          extractionRule: 'v1-baseline',
          mechanics: classifyMotion(candidate.motionText),
          source: {
            sourceId: source.id,
            title: source.title,
            url: source.url,
            publishedAt: source.publishedAt,
            contentSha256: source.contentSha256,
          },
          mechanicallyActionable: false,
          finalPassageInference: 'none',
        }, 'baseline');
      }

      const members = adaptedExpansionMembers(target);
      const aliases = buildPageAliases(lines, members);
      const blocks = findExpandedRollCalls(lines, target.identifier);
      let supplementalForMatch = 0;
      for (const block of blocks) {
        for (const [voteSide, rawNames] of [['aye', block.ayes], ['nay', block.nays]] as const) {
          for (const rawName of rawNames) {
            const resolved = resolveVoteName(rawName, members, aliases);
            if (!resolved.member) {
              diagnostics.push({
                sourceId: source.id,
                voteEventId: target.voteEventId,
                identifier: target.identifier,
                type: resolved.ambiguous ? 'ambiguous_vote_name' : 'unresolved_vote_name',
                rawName,
                detail: `Could not ${resolved.ambiguous ? 'uniquely ' : ''}resolve named committee vote to the frozen chamber roster.`,
              });
              continue;
            }
            const member = resolved.member;
            const before = observations.length;
            addObservation({
              stableKey: target.stableKey,
              voteEventId: target.voteEventId,
              identifier: target.identifier,
              session: target.session,
              partition: target.partition,
              occurredOn: target.occurredOn,
              asOf: target.asOf,
              membershipId: member.membershipId,
              legislatorId: member.legislatorId,
              memberName: member.memberName,
              party: member.party,
              district: member.district,
              quickYesProbability: member.yesProbability,
              voteSide,
              motionText: block.motionText,
              excerpt: block.excerpt,
              extractionRule: block.extractionRule,
              mechanics: classifyMotion(block.motionText),
              source: {
                sourceId: source.id,
                title: source.title,
                url: source.url,
                publishedAt: source.publishedAt,
                contentSha256: source.contentSha256,
              },
              mechanicallyActionable: false,
              finalPassageInference: 'none',
            }, 'supplemental');
            if (observations.length > before) supplementalForMatch += 1;
          }
        }
      }
      if (baseline.candidates.length === 0 && supplementalForMatch === 0 && blocks.length === 0) {
        diagnostics.push({
          sourceId: source.id,
          voteEventId: target.voteEventId,
          identifier: target.identifier,
          type: 'no_named_bill_roll_call',
          detail: 'No deterministic named-member exact-bill procedural roll call was found. Voice votes, amendments, and unrelated roll calls remain excluded.',
        });
      }
    }
  }

  observations.sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)
    || left.stableKey.localeCompare(right.stableKey)
    || left.source.sourceId.localeCompare(right.source.sourceId)
    || left.motionText.localeCompare(right.motionText)
    || left.membershipId.localeCompare(right.membershipId)
    || left.voteSide.localeCompare(right.voteSide));

  const featureByPair = new Map<string, QuickEvidenceCommitteeRollcallFeatureRow>();
  for (const observation of observations) {
    const key = `${observation.voteEventId}|${observation.membershipId}`;
    let row = featureByPair.get(key);
    if (!row) {
      row = {
        stableKey: observation.stableKey,
        voteEventId: observation.voteEventId,
        identifier: observation.identifier,
        session: observation.session,
        partition: observation.partition,
        occurredOn: observation.occurredOn,
        membershipId: observation.membershipId,
        legislatorId: observation.legislatorId,
        memberName: observation.memberName,
        party: observation.party,
        quickYesProbability: observation.quickYesProbability,
        features: emptyFeatures(),
      };
      featureByPair.set(key, row);
    }
    const mechanics = observation.mechanics.length > 0 ? observation.mechanics : [undefined];
    for (const mechanic of mechanics) {
      row.features[mechanicFeature(mechanic, observation.voteSide)] += 1;
    }
  }
  const featureRows = [...featureByPair.values()].sort((left, right) =>
    left.occurredOn.localeCompare(right.occurredOn)
    || left.stableKey.localeCompare(right.stableKey)
    || left.membershipId.localeCompare(right.membershipId));

  const bySession = Object.fromEntries(manifest.metadata.sessions.map((session) => {
    const sessionObservations = observations.filter((item) => item.session === session);
    const sessionRows = featureRows.filter((item) => item.session === session);
    return [session, {
      observations: sessionObservations.length,
      memberEventPairsWithFeatures: sessionRows.length,
      eventsWithFeatures: new Set(sessionRows.map((item) => item.voteEventId)).size,
    }];
  }));

  return {
    schemaVersion: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_CANDIDATE_SCHEMA,
    generatedAt,
    purpose: 'outcome-blind broad deterministic extraction of exact-bill named-member Minnesota House committee roll calls under the frozen zero-weight committee diagnostic',
    metadata: {
      parser: HISTORICAL_DEEP_EXPANSION_PARSER_V2,
      baselineParser: 'deterministic-house-committee-roll-call-v1',
      mechanicsPolicy: HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY,
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      outcomeUse: 'none',
      probabilityAction: 'none',
      designGuard: 'Reuses the already-frozen v1 parser plus parser-v2 format extensions and the existing procedural mechanics taxonomy. AYE/NAY means support/opposition to the recorded committee motion only; no final-passage outcome, weight, or probability inference enters extraction.',
    },
    input: {
      manifestCases: manifest.cases.length,
      manifestMemberCasePairs: manifest.metadata.memberCasePairs,
      sourcePages: sources.sources.length,
      sourceCaseMatches: sources.summary.sourceCaseMatches,
    },
    summary: {
      observations: observations.length,
      baselineObservations,
      supplementalObservations,
      memberEventPairsWithFeatures: featureRows.length,
      eventsWithFeatures: new Set(featureRows.map((item) => item.voteEventId)).size,
      sourcesWithFeatures: new Set(observations.map((item) => item.source.sourceId)).size,
      ayeObservations: observations.filter((item) => item.voteSide === 'aye').length,
      nayObservations: observations.filter((item) => item.voteSide === 'nay').length,
      observationsWithMultipleMechanics: observations.filter((item) => item.mechanics.length > 1).length,
      unclassifiedObservations: observations.filter((item) => item.mechanics.length === 0).length,
      bySession,
    },
    observations,
    featureRows,
    diagnostics,
  };
}
