import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scoreHistoricalDeepHouseJournalMechanics,
  type HistoricalDeepHouseJournalMechanicsScoreLineage,
} from '../src/evaluation/historical-deep-house-journal-mechanics-score.js';
import type {
  HistoricalDeepHouseJournalMechanic,
  HistoricalDeepHouseJournalMechanicDirection,
  HistoricalDeepHouseJournalExtractionRule,
} from '../src/evaluation/historical-deep-house-journal-mechanics.js';

const mechanics: HistoricalDeepHouseJournalMechanic[] = [
  'introduced_and_referred',
  'committee_advances_to_general_register',
  'committee_routes_for_additional_review',
  'second_reading',
  'calendar_designation',
  'companion_substitution',
  'conference_committee_appointment',
  'conference_report_received',
  'interchamber_amendment_message',
  'reported_to_house',
  'laid_on_table',
  'reaches_final_passage_stage',
  'author_added',
];

const direction: Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalMechanicDirection> = {
  introduced_and_referred: 'continues_process',
  committee_advances_to_general_register: 'advances_process',
  committee_routes_for_additional_review: 'continues_process',
  second_reading: 'advances_process',
  calendar_designation: 'advances_process',
  companion_substitution: 'advances_process',
  conference_committee_appointment: 'continues_process',
  conference_report_received: 'advances_process',
  interchamber_amendment_message: 'continues_process',
  reported_to_house: 'advances_process',
  laid_on_table: 'defers_or_impedes',
  reaches_final_passage_stage: 'advances_process',
  author_added: 'administrative_only',
};

const extractionRule: Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalExtractionRule> = {
  introduced_and_referred: 'introduced-first-reading-referral',
  committee_advances_to_general_register: 'standing-committee-general-register-report',
  committee_routes_for_additional_review: 'standing-committee-rereferral-report',
  second_reading: 'direct-second-reading',
  calendar_designation: 'rules-calendar-designation-list',
  companion_substitution: 'chief-clerk-companion-substitution',
  conference_committee_appointment: 'conference-committee-appointment',
  conference_report_received: 'conference-report-heading',
  interchamber_amendment_message: 'interchamber-amendment-message',
  reported_to_house: 'direct-reported-to-house',
  laid_on_table: 'direct-laid-on-table-motion',
  reaches_final_passage_stage: 'direct-third-reading-final-passage-stage',
  author_added: 'direct-author-addition',
};

function artifactRef(fill: string, artifactId: number) {
  return {
    workflowRunId: String(artifactId),
    artifactId,
    artifactName: `artifact-${artifactId}`,
    artifactSha256: fill.repeat(64),
    headSha: fill.repeat(40),
    fileName: `artifact-${artifactId}.json`,
  };
}

function lineage(): HistoricalDeepHouseJournalMechanicsScoreLineage {
  return {
    schemaVersion: 'historical-deep-house-journal-mechanics-score-lineage-v1',
    discoveryManifest: artifactRef('a', 1),
    mechanicsArtifact: artifactRef('b', 2),
    outcomeArtifact: {
      ...artifactRef('c', 3),
      originCandidateArtifactId: 4,
      originCandidateArtifactSha256: 'd'.repeat(64),
    },
    policy: {
      evaluation: 'mechanic-conditioned-quick-residual-diagnostic-v1',
      outcomeUse: 'post-mechanics-freeze-development-scoring-only',
      probabilityAction: 'none',
      actionabilityDecision: 'none',
      notes: 'fixture',
    },
  };
}

function fixture() {
  const pinned = lineage();
  const cases = Array.from({ length: 24 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return {
      stableKey: `stable-${index}`,
      caseKey: `case-${index}`,
      externalKey: `external-${index}`,
      voteEventId: `vote-${index}`,
      identifier: `HF${index + 1}`,
      occurredOn: `2022-03-${day}`,
      quickModelVersion: 'quick-v1',
    };
  });

  const observations = Array.from({ length: 107 }, (_, index) => {
    const caseInfo = cases[index % cases.length];
    const mechanic = mechanics[index % mechanics.length];
    return {
      id: `observation-${index}`,
      stableKey: caseInfo.stableKey,
      caseKey: caseInfo.caseKey,
      voteEventId: caseInfo.voteEventId,
      externalKey: caseInfo.externalKey,
      identifier: caseInfo.identifier,
      occurredOn: caseInfo.occurredOn,
      tranche: 'deterministic-uniform',
      sourceId: `source-${index}`,
      sourceUrl: `https://example.test/${index}`,
      sourceContentSha256: 'e'.repeat(64),
      journalDate: '2022-02-01',
      legislativeDay: 1,
      mechanic,
      direction: direction[mechanic],
      extractionRule: extractionRule[mechanic],
      evidenceText: `${caseInfo.identifier} fixture evidence`,
      mechanicallyActionable: false,
      finalPassageInference: 'none',
    };
  });

  const mechanicsByCase = new Map<string, HistoricalDeepHouseJournalMechanic[]>();
  for (const observation of observations) {
    const values = mechanicsByCase.get(observation.stableKey) ?? [];
    if (!values.includes(observation.mechanic)) values.push(observation.mechanic);
    mechanicsByCase.set(observation.stableKey, values);
  }

  const mechanicsCounts = Object.fromEntries(mechanics.map((mechanic) => [
    mechanic,
    observations.filter((item) => item.mechanic === mechanic).length,
  ]));
  const directions: HistoricalDeepHouseJournalMechanicDirection[] = [
    'advances_process',
    'continues_process',
    'defers_or_impedes',
    'administrative_only',
  ];
  const directionCounts = Object.fromEntries(directions.map((item) => [
    item,
    observations.filter((observation) => observation.direction === item).length,
  ]));

  const discoveryCases = cases.map((caseInfo, caseIndex) => ({
    ...caseInfo,
    billId: `bill-${caseIndex}`,
    title: `Fixture ${caseIndex}`,
    session: '2021-2022',
    chamberId: 'house-id',
    chamber: 'house',
    asOf: '2022-02-28T23:59:59.999Z',
    targetVersionId: 'target-v1',
    members: Array.from({ length: 134 }, (_, memberIndex) => ({
      membershipId: `membership-${caseIndex}-${memberIndex}`,
      legislatorId: `legislator-${caseIndex}-${memberIndex}`,
      memberName: `Member ${caseIndex}-${memberIndex}`,
      party: 'DFL',
      yesProbability: 0.75,
      evidenceQuality: 'strong',
      support: { global: 100, party: 50, member: 10, analogue: 1 },
      selectedForCurrentDeep: false,
      selectedForCandidateDeep: false,
    })),
    currentDeepTargetIds: [],
    candidateDeepTargetIds: [],
    discoveryRequest: {},
  }));

  const discovery = {
    schemaVersion: 'historical-deep-expansion-discovery-manifest-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: pinned.discoveryManifest.headSha,
      databaseSource: 'fixture',
      purpose: 'evaluation-only outcome-blind fixture',
      selectionGuard: 'outcomes are excluded from this fixture selector',
      cohortGeneratedAt: '2026-09-12T00:00:00.000Z',
      cohortCodeSha: null,
      cases: 24,
      memberCasePairs: 3_216,
      currentDeepTargetLimit: 12,
      candidateStrategy: 'need-only',
    },
    cases: discoveryCases,
  };

  const mechanicsArtifact = {
    schemaVersion: 'historical-deep-house-journal-mechanics-v1',
    generatedAt: '2026-09-13T01:00:00.000Z',
    purpose: 'fixture',
    metadata: {
      parser: 'deterministic-house-journal-mechanics-v1',
      inputSourceSchema: 'historical-deep-house-journal-source-bundle-v1',
      inputSourcePolicy: 'house-journal-archive-enumeration-v1',
      sourceArtifactId: 99,
      sourceArtifactDigest: `sha256:${'f'.repeat(64)}`,
      sourceHeadSha: 'f'.repeat(40),
      outcomeUse: 'none',
      holdoutUse: 'none',
      probabilityAction: 'none',
      designGuard: 'fixture',
    },
    input: {
      selectedCases: 24,
      sourcePages: 71,
      sourceCasePairs: 110,
    },
    summary: {
      observations: 107,
      casesWithMechanics: 24,
      casesWithoutMechanics: 0,
      sourcePagesWithMechanics: 65,
      sourceCasePairsWithMechanics: 95,
      unclassifiedSourceCasePairs: 15,
      mechanics: mechanicsCounts,
      directions: directionCounts,
    },
    cases: cases.map((caseInfo) => ({
      ...caseInfo,
      session: '2021-2022',
      tranche: 'deterministic-uniform',
      sourceIds: ['source'],
      mechanicObservationIds: observations.filter((item) => item.stableKey === caseInfo.stableKey).map((item) => item.id),
      mechanics: mechanicsByCase.get(caseInfo.stableKey) ?? [],
    })),
    observations,
  };

  const outcomes = {
    schemaVersion: 'historical-deep-expansion-outcome-snapshot-v1',
    generatedAt: '2026-09-13T02:00:00.000Z',
    codeSha: pinned.outcomeArtifact.headSha,
    purpose: 'fixture',
    candidateArtifact: {
      workflowRunId: '4',
      artifactId: pinned.outcomeArtifact.originCandidateArtifactId,
      artifactName: 'origin-candidates',
      artifactSha256: pinned.outcomeArtifact.originCandidateArtifactSha256,
      headSha: 'd'.repeat(40),
      fileName: 'origin.json',
    },
    cases: cases.map((caseInfo, caseIndex) => ({
      stableKey: caseInfo.stableKey,
      caseKey: caseInfo.caseKey,
      externalKey: caseInfo.externalKey,
      voteEventId: caseInfo.voteEventId,
      identifier: caseInfo.identifier,
      occurredOn: caseInfo.occurredOn,
      session: '2021-2022',
      chamber: 'house',
      tranche: 'deterministic-uniform',
      members: [
        {
          membershipId: `membership-${caseIndex}-0`,
          legislatorId: `legislator-${caseIndex}-0`,
          memberName: `Member ${caseIndex}-0`,
          actualOutcome: 1,
        },
        {
          membershipId: `membership-${caseIndex}-1`,
          legislatorId: `legislator-${caseIndex}-1`,
          memberName: `Member ${caseIndex}-1`,
          actualOutcome: 0,
        },
      ],
    })),
  };

  return { pinned, discovery, mechanicsArtifact, outcomes };
}

test('scores frozen bill-level Journal mechanics against decisive member outcomes descriptively', () => {
  const { pinned, discovery, mechanicsArtifact, outcomes } = fixture();
  const result = scoreHistoricalDeepHouseJournalMechanics({
    discovery: discovery as never,
    mechanics: mechanicsArtifact as never,
    outcomes: outcomes as never,
    lineage: pinned,
    generatedAt: '2026-09-13T03:00:00.000Z',
  });

  assert.equal(result.schemaVersion, 'historical-deep-house-journal-mechanics-score-v1');
  assert.equal(result.metadata.evaluationPolicy, 'mechanic-conditioned-quick-residual-diagnostic-v1');
  assert.equal(result.metadata.probabilityAction, 'none');
  assert.equal(result.metadata.actionabilityDecision, 'none');
  assert.equal(result.input.discoveryCases, 24);
  assert.equal(result.input.discoveryMemberCasePairs, 3_216);
  assert.equal(result.input.mechanicsObservations, 107);
  assert.equal(result.input.decisiveMemberOutcomes, 48);
  assert.equal(result.summary.mechanicallyActionableObservations, 0);
  assert.equal(result.summary.finalPassageInferenceObservations, 0);
  assert.equal(result.summary.overall.actualYesRate, 0.5);
  assert.equal(result.summary.overall.quickMeanYesProbability, 0.75);
  assert.equal(result.summary.overall.memberWeightedSignedResidual, -0.25);
  assert.equal(result.summary.overall.quickBrier, 0.3125);
  assert.equal(result.summary.overall.quickAccuracy, 0.5);
  assert.equal(result.summary.cooccurrence.length, 78);
  assert.ok(result.summary.mechanics.reaches_final_passage_stage.withMechanic.cases > 0);
  assert.ok(result.summary.directions.defers_or_impedes.withDirection.cases > 0);
  assert.ok(result.summary.mechanics.author_added.lastObservationRecency.minimumDaysBeforeVote > 0);
  assert.ok(result.cases.every((item) => item.signedResidual === -0.25));
});

test('fails closed if the frozen mechanics artifact contains actionable evidence', () => {
  const { pinned, discovery, mechanicsArtifact, outcomes } = fixture();
  mechanicsArtifact.observations[0].mechanicallyActionable = true as never;
  assert.throws(() => scoreHistoricalDeepHouseJournalMechanics({
    discovery: discovery as never,
    mechanics: mechanicsArtifact as never,
    outcomes: outcomes as never,
    lineage: pinned,
  }), /actionable\/final-passage inference evidence/);
});

test('fails closed when development event lineage drifts across frozen inputs', () => {
  const { pinned, discovery, mechanicsArtifact, outcomes } = fixture();
  outcomes.cases[0].identifier = 'HF9999';
  assert.throws(() => scoreHistoricalDeepHouseJournalMechanics({
    discovery: discovery as never,
    mechanics: mechanicsArtifact as never,
    outcomes: outcomes as never,
    lineage: pinned,
  }), /Case lineage mismatch/);
});

test('fails closed when the outcome snapshot origin candidate digest drifts', () => {
  const { pinned, discovery, mechanicsArtifact, outcomes } = fixture();
  outcomes.candidateArtifact.artifactSha256 = '0'.repeat(64);
  assert.throws(() => scoreHistoricalDeepHouseJournalMechanics({
    discovery: discovery as never,
    mechanics: mechanicsArtifact as never,
    outcomes: outcomes as never,
    lineage: pinned,
  }), /candidate artifact digest drifted/);
});
