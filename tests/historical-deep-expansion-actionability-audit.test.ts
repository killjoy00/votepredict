import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepExpansionImpactReplayV2 } from '../src/evaluation/historical-deep-expansion-impact-replay-v2';
import {
  auditHistoricalDeepExpansionActionability,
} from '../src/evaluation/historical-deep-expansion-actionability-audit';
import type { HistoricalDeepProceduralMechanicsArtifact } from '../src/evaluation/historical-deep-procedural-mechanics';

const quick = {
  observations: 4,
  accuracy: 0.75,
  brier: 0.2,
  logLoss: 0.5,
  expectedCalibrationError: 0.1,
};

function scenario(
  name: 'current-targets' | 'need-only-targets' | 'discovery-all',
  candidateObservations: number,
  appliedEvidenceItems: number,
): HistoricalDeepExpansionImpactReplayV2['scenarios'][typeof name] {
  return {
    name,
    description: name,
    requestedTargets: name === 'discovery-all' ? 8 : 2,
    candidateObservations,
    evidenceItems: appliedEvidenceItems,
    appliedEvidenceItems,
    excludedEvidenceItems: 0,
    affectedMembers: appliedEvidenceItems,
    changedMembers: appliedEvidenceItems,
    decisiveMemberPairs: quick.observations,
    affectedDecisiveMemberPairs: appliedEvidenceItems,
    correctedClassifications: 0,
    harmedClassifications: 0,
    classificationFlips: 0,
    allDecisive: {
      status: 'evaluable',
      observations: quick.observations,
      quick,
      deep: {
        ...quick,
        brier: quick.brier - 0.01,
        logLoss: quick.logLoss - 0.01,
      },
      delta: {
        brier: -0.01,
        logLoss: -0.01,
        expectedCalibrationError: 0,
        accuracy: 0,
      },
      movement: {
        changed: appliedEvidenceItems,
        unchanged: quick.observations - appliedEvidenceItems,
        improved: appliedEvidenceItems,
        worsened: 0,
        meanAbsoluteMovement: 0.01,
        meanSignedMovement: 0.01,
      },
    },
    affectedDecisive: {
      status: 'insufficient-sample',
      observations: 0,
      delta: {},
      movement: {
        changed: 0,
        unchanged: 0,
        improved: 0,
        worsened: 0,
        meanAbsoluteMovement: 0,
        meanSignedMovement: 0,
      },
    },
    cases: [],
  };
}

function replayFixture(): HistoricalDeepExpansionImpactReplayV2 {
  return {
    schemaVersion: 'historical-deep-expansion-impact-replay-v2',
    generatedAt: '2026-01-01T00:00:00.000Z',
    purpose: 'fixture',
    metadata: {
      candidateStrategy: 'need-only',
      targetLimit: 12,
      impactVersion: 'logit-evidence-v1',
      evidenceKind: 'fact',
      sourceQuality: 'official',
      relevance: 'high',
      confidence: 1,
      outcomeUse: 'post-freeze scoring only',
      evidenceMechanism: 'fixture',
      interpretation: 'fixture',
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      signalClassifier: 'historical-deep-outcome-scorer-v1-unchanged',
      ambiguousEvidencePolicy: 'fixture',
      adapterPolicy: 'fixture',
    },
    input: {
      discoveryCases: 1,
      discoveryMemberCasePairs: 8,
      frozenSourcePages: 1,
      frozenSourceCaseMatches: 1,
      candidateObservations: 2,
      outcomeCases: 1,
      decisiveMemberOutcomes: 4,
    },
    signalContext: {
      memberCasePairs: 2,
      directionalPairs: 2,
      conflictingPairs: 0,
      currentDeepPairs: 1,
      candidateDeepPairs: 1,
      conflictingCurrentDeepPairs: 0,
      conflictingCandidateDeepPairs: 0,
    },
    comparison: {
      quick,
    },
    scenarios: {
      'current-targets': scenario('current-targets', 1, 1),
      'need-only-targets': scenario('need-only-targets', 1, 1),
      'discovery-all': scenario('discovery-all', 2, 2),
    },
  };
}

function taxonomyFixture(): HistoricalDeepProceduralMechanicsArtifact {
  return {
    schemaVersion: 'historical-deep-procedural-mechanics-v1',
    generatedAt: '2026-01-02T00:00:00.000Z',
    purpose: 'fixture',
    metadata: {
      policy: 'mn-house-procedural-mechanics-v1',
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      outcomeUse: 'none',
      probabilityAction: 'none',
      designGuard: 'fixture',
      institutionalSources: [],
    },
    input: {
      candidateObservations: 2,
      memberEventPairs: 2,
      eventsWithCandidates: 1,
    },
    summary: {
      observations: 2,
      memberEventPairs: 2,
      observationsWithMultipleMechanics: 0,
      unclassifiedObservations: 0,
      mechanics: {
        committee_recommends_passage: 0,
        advances_toward_floor_eligibility: 1,
        continues_committee_review: 1,
        impedes_current_bill_progress: 0,
        defers_current_bill_action: 0,
      },
      ayeObservations: 2,
      nayObservations: 0,
      currentTargetObservations: 1,
      candidateTargetObservations: 1,
    },
    observations: [
      { mechanicallyActionable: false, finalPassageInference: 'none' },
      { mechanicallyActionable: false, finalPassageInference: 'none' },
    ],
    pairs: [
      { mechanicallyActionable: false, finalPassageInference: 'none' },
      { mechanicallyActionable: false, finalPassageInference: 'none' },
    ],
  } as unknown as HistoricalDeepProceduralMechanicsArtifact;
}

test('actionability audit blocks all frozen non-actionable procedural observations', () => {
  const audit = auditHistoricalDeepExpansionActionability(
    replayFixture(),
    taxonomyFixture(),
    '2026-01-03T00:00:00.000Z',
  );

  assert.equal(audit.summary.mechanicallyActionableObservations, 0);
  assert.equal(audit.summary.blockedObservations, 2);
  assert.equal(audit.scenarios['current-targets'].legacy.appliedEvidenceItems, 1);
  assert.equal(audit.scenarios['discovery-all'].legacy.appliedEvidenceItems, 2);

  for (const scenarioName of ['current-targets', 'need-only-targets', 'discovery-all'] as const) {
    const gated = audit.scenarios[scenarioName].gated;
    assert.equal(gated.appliedEvidenceItems, 0);
    assert.equal(gated.changedMembers, 0);
    assert.equal(gated.delta.brier, 0);
    assert.equal(gated.delta.logLoss, 0);
    assert.deepEqual(gated.deep, gated.quick);
  }
});

test('actionability audit fails closed when frozen lineage counts disagree', () => {
  const taxonomy = taxonomyFixture();
  taxonomy.summary.currentTargetObservations = 2;
  assert.throws(
    () => auditHistoricalDeepExpansionActionability(replayFixture(), taxonomy),
    /Current-target candidate count does not match frozen taxonomy/,
  );
});
