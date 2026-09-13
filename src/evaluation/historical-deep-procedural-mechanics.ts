import type {
  HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  HistoricalDeepExpansionDiscoveryCandidateV2,
} from './historical-deep-expansion-extractor-v2';

export const HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCHEMA = 'historical-deep-procedural-mechanics-v1' as const;
export const HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY = 'mn-house-procedural-mechanics-v1' as const;

export type HistoricalDeepProceduralMechanic =
  | 'committee_recommends_passage'
  | 'advances_toward_floor_eligibility'
  | 'continues_committee_review'
  | 'impedes_current_bill_progress'
  | 'defers_current_bill_action';

export interface HistoricalDeepProceduralMechanicsObservation {
  caseKey: string;
  stableKey: string;
  voteEventId: string;
  identifier: string;
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string | null;
  voteSide: 'aye' | 'nay';
  voteRelationToMotion: 'supports_motion' | 'opposes_motion';
  motionText: string;
  extractionRule: HistoricalDeepExpansionDiscoveryCandidateV2['extractionRule'];
  mechanics: HistoricalDeepProceduralMechanic[];
  source: HistoricalDeepExpansionDiscoveryCandidateV2['source'];
  selectedForCurrentDeep: boolean;
  selectedForCandidateDeep: boolean;
  mechanicallyActionable: false;
  finalPassageInference: 'none';
}

export interface HistoricalDeepProceduralMechanicsPair {
  caseKey: string;
  stableKey: string;
  voteEventId: string;
  identifier: string;
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string | null;
  selectedForCurrentDeep: boolean;
  selectedForCandidateDeep: boolean;
  observationCount: number;
  voteSides: Array<'aye' | 'nay'>;
  mechanics: HistoricalDeepProceduralMechanic[];
  extractionRules: HistoricalDeepExpansionDiscoveryCandidateV2['extractionRule'][];
  mechanicallyActionable: false;
  finalPassageInference: 'none';
}

export interface HistoricalDeepProceduralMechanicsArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    policy: typeof HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY;
    candidateParser: 'deterministic-house-committee-roll-call-v2';
    outcomeUse: 'none';
    probabilityAction: 'none';
    designGuard: string;
    institutionalSources: Array<{
      label: string;
      url: string;
      supports: string;
    }>;
  };
  input: {
    candidateObservations: number;
    memberEventPairs: number;
    eventsWithCandidates: number;
  };
  summary: {
    observations: number;
    memberEventPairs: number;
    observationsWithMultipleMechanics: number;
    unclassifiedObservations: number;
    mechanics: Record<HistoricalDeepProceduralMechanic, number>;
    ayeObservations: number;
    nayObservations: number;
    currentTargetObservations: number;
    candidateTargetObservations: number;
  };
  observations: HistoricalDeepProceduralMechanicsObservation[];
  pairs: HistoricalDeepProceduralMechanicsPair[];
}

const MECHANIC_ORDER: HistoricalDeepProceduralMechanic[] = [
  'committee_recommends_passage',
  'advances_toward_floor_eligibility',
  'continues_committee_review',
  'impedes_current_bill_progress',
  'defers_current_bill_action',
];

function classifyMotion(motionText: string): HistoricalDeepProceduralMechanic[] {
  const mechanics = new Set<HistoricalDeepProceduralMechanic>();

  if (/\brecommend(?:ed)?\s+to\s+pass\b/i.test(motionText)) {
    mechanics.add('committee_recommends_passage');
  }

  if (/\bgeneral\s+register\b/i.test(motionText)
    && /\b(?:place(?:d)?|recommend(?:ed)?)\b/i.test(motionText)) {
    mechanics.add('advances_toward_floor_eligibility');
  }

  if (/\bre-?refer(?:red|ral)?\b/i.test(motionText)
    || /\brefer(?:red|ral)?\b/i.test(motionText)) {
    mechanics.add('continues_committee_review');
  }

  if (/\btabl(?:e|ed|ing)\b/i.test(motionText)) {
    mechanics.add('impedes_current_bill_progress');
  }

  if (/\blaid\s+over\b/i.test(motionText)) {
    mechanics.add('defers_current_bill_action');
  }

  return MECHANIC_ORDER.filter((mechanic) => mechanics.has(mechanic));
}

function pairKey(observation: HistoricalDeepProceduralMechanicsObservation): string {
  return `${observation.caseKey}|${observation.legislatorId}`;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function summarizeMechanics(
  observations: readonly HistoricalDeepProceduralMechanicsObservation[],
): Record<HistoricalDeepProceduralMechanic, number> {
  return Object.fromEntries(
    MECHANIC_ORDER.map((mechanic) => [
      mechanic,
      observations.filter((observation) => observation.mechanics.includes(mechanic)).length,
    ]),
  ) as Record<HistoricalDeepProceduralMechanic, number>;
}

export function buildHistoricalDeepProceduralMechanicsArtifact(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  generatedAt = new Date().toISOString(),
): HistoricalDeepProceduralMechanicsArtifact {
  if (candidates.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v2') {
    throw new Error(`Unsupported candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (candidates.metadata.parser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Unsupported candidate parser: ${String(candidates.metadata.parser)}`);
  }
  if (candidates.metadata.outcomeUse !== 'none') {
    throw new Error(`Candidate artifact is not outcome-blind: ${String(candidates.metadata.outcomeUse)}`);
  }
  if (candidates.summary.candidateCount !== candidates.candidates.length) {
    throw new Error('Candidate summary does not match candidate observations');
  }

  const observations: HistoricalDeepProceduralMechanicsObservation[] = candidates.candidates.map((candidate) => ({
    caseKey: candidate.case.caseKey,
    stableKey: candidate.case.stableKey,
    voteEventId: candidate.case.voteEventId,
    identifier: candidate.case.identifier,
    occurredOn: candidate.case.occurredOn,
    membershipId: candidate.membershipId,
    legislatorId: candidate.legislatorId,
    memberName: candidate.memberName,
    party: candidate.party,
    voteSide: candidate.voteSide,
    voteRelationToMotion: candidate.voteSide === 'aye' ? 'supports_motion' : 'opposes_motion',
    motionText: candidate.motionText,
    extractionRule: candidate.extractionRule,
    mechanics: classifyMotion(candidate.motionText),
    source: candidate.source,
    selectedForCurrentDeep: candidate.selectedForCurrentDeep,
    selectedForCandidateDeep: candidate.selectedForCandidateDeep,
    mechanicallyActionable: false,
    finalPassageInference: 'none',
  }));

  const grouped = new Map<string, HistoricalDeepProceduralMechanicsObservation[]>();
  for (const observation of observations) {
    const key = pairKey(observation);
    const values = grouped.get(key) ?? [];
    values.push(observation);
    grouped.set(key, values);
  }

  const pairs: HistoricalDeepProceduralMechanicsPair[] = [...grouped.values()].map(
    (values): HistoricalDeepProceduralMechanicsPair => {
      const first = values[0];
      return {
        caseKey: first.caseKey,
        stableKey: first.stableKey,
        voteEventId: first.voteEventId,
        identifier: first.identifier,
        occurredOn: first.occurredOn,
        membershipId: first.membershipId,
        legislatorId: first.legislatorId,
        memberName: first.memberName,
        party: first.party,
        selectedForCurrentDeep: first.selectedForCurrentDeep,
        selectedForCandidateDeep: first.selectedForCandidateDeep,
        observationCount: values.length,
        voteSides: uniqueSorted(values.map((value) => value.voteSide)),
        mechanics: MECHANIC_ORDER.filter((mechanic) => values.some((value) => value.mechanics.includes(mechanic))),
        extractionRules: uniqueSorted(values.map((value) => value.extractionRule)),
        mechanicallyActionable: false,
        finalPassageInference: 'none',
      };
    },
  ).sort((left, right) => left.stableKey.localeCompare(right.stableKey)
    || left.legislatorId.localeCompare(right.legislatorId));

  if (pairs.length !== candidates.summary.memberCasePairsWithCandidates) {
    throw new Error(`Candidate member-pair count changed during mechanics classification: expected ${candidates.summary.memberCasePairsWithCandidates}, got ${pairs.length}`);
  }

  return {
    schemaVersion: HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCHEMA,
    generatedAt,
    purpose: 'evaluation-only outcome-blind taxonomy of what each frozen official committee roll-call motion mechanically does in the Minnesota House process; deliberately makes no final-passage probability inference and cannot affect a forecast',
    metadata: {
      policy: HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY,
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      outcomeUse: 'none',
      probabilityAction: 'none',
      designGuard: 'Motion mechanics are separated from final-passage inference. AYE/NAY only means support/opposition to the recorded committee motion. Re-referral is treated as continued committee review because House rules can require jurisdictional re-referral; General Register placement is treated as advancement toward floor eligibility because a bill must be on the General Register before Calendar for the Day/Fiscal Calendar consideration. All observations remain mechanicallyActionable=false until separately validated for final-passage prediction.',
      institutionalSources: [
        {
          label: 'Minnesota House Rule 1.20 - General Register',
          url: 'https://www.house.mn.gov/cco/rules/permrule/120.htm',
          supports: 'General Register placement is a required procedural step before Calendar for the Day or Fiscal Calendar consideration.',
        },
        {
          label: 'Minnesota House 2021 adopted rules - Rules 1.20, 1.30, 4.10, 4.15, 4.16',
          url: 'https://www.house.mn.gov/cco/journals/2021-22/J0107002.htm',
          supports: 'The same General Register structure applied in the 2021-22 development session; referrals and re-referrals can be required by committee jurisdiction and can occur before passage.',
        },
        {
          label: 'Minnesota House Rule 4.13 - jurisdictional referrals',
          url: 'https://www.house.mn.gov/cco/rules/permrule/413.htm',
          supports: 'Current House rules likewise require re-referral for some bills, so re-referral is process routing rather than a direct final-passage endorsement.',
        },
      ],
    },
    input: {
      candidateObservations: candidates.summary.candidateCount,
      memberEventPairs: candidates.summary.memberCasePairsWithCandidates,
      eventsWithCandidates: candidates.summary.casesWithCandidates,
    },
    summary: {
      observations: observations.length,
      memberEventPairs: pairs.length,
      observationsWithMultipleMechanics: observations.filter((observation) => observation.mechanics.length > 1).length,
      unclassifiedObservations: observations.filter((observation) => observation.mechanics.length === 0).length,
      mechanics: summarizeMechanics(observations),
      ayeObservations: observations.filter((observation) => observation.voteSide === 'aye').length,
      nayObservations: observations.filter((observation) => observation.voteSide === 'nay').length,
      currentTargetObservations: observations.filter((observation) => observation.selectedForCurrentDeep).length,
      candidateTargetObservations: observations.filter((observation) => observation.selectedForCandidateDeep).length,
    },
    observations,
    pairs,
  };
}
