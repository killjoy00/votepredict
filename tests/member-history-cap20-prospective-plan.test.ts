import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const plan = JSON.parse(readFileSync(new URL('../data/evaluation/member-history-cap20-prospective-plan-v1.json', import.meta.url), 'utf8')) as any;

test('freezes the cap-20 prospective lineage and no-action boundary', () => {
  assert.equal(plan.schemaVersion, 'member-history-cap20-prospective-plan-v1');
  assert.equal(plan.candidateLineage.modelVersion, 'member-eb-v1.1');
  assert.equal(plan.candidateLineage.baselineMaximumMemberHistoryWeight, 'uncapped');
  assert.equal(plan.candidateLineage.candidateMaximumMemberHistoryWeight, 20);
  assert.equal(plan.candidateLineage.selectionArtifact.artifactId, 10329544331);
  assert.equal(plan.candidateLineage.exactHoldoutReplayArtifact.artifactId, 10334010514);
  assert.equal(plan.candidateLineage.retrospectiveSummary.baselineReproductionMaximumAbsoluteProbabilityDifference, 0);
  assert.equal(plan.guardrails.candidateServesTraffic, false);
  assert.equal(plan.guardrails.probabilityAction, 'none');
  assert.equal(plan.guardrails.runtimeDefaultChange, false);
  assert.equal(plan.guardrails.modelVersionChange, false);
  assert.equal(plan.guardrails.promotionRequiresSeparateReviewedChange, true);
});

test('freezes future enrollment, reveal timing, and minimum samples before outcomes', () => {
  assert.equal(plan.prospectiveCohort.session, '2027-2028');
  assert.equal(plan.prospectiveCohort.researchMode, 'quick');
  assert.equal(plan.prospectiveCohort.primaryChamber, 'house');
  assert.equal(plan.prospectiveCohort.safetyChamber, 'senate');
  assert.equal(plan.prospectiveCohort.noReplacement, true);
  assert.equal(plan.prospectiveCohort.noRetrospectiveReconstruction, true);
  assert.equal(plan.prospectiveCohort.shadowCaptureRequiredAtForecastTime, true);
  assert.equal(plan.revealPolicy.notBefore, '2028-07-01T00:00:00Z');
  assert.equal(plan.revealPolicy.singleFinalReveal, true);
  assert.equal(plan.revealPolicy.sequentialPeeking, false);
  assert.equal(plan.revealPolicy.thresholdChangesAfterCaptureStarts, false);
  assert.deepEqual(plan.minimumSample.house, { voteEvents: 20, decisiveMemberOutcomes: 2500 });
  assert.deepEqual(plan.minimumSample.senateSafety, { voteEvents: 12, decisiveMemberOutcomes: 700 });
});

test('freezes stricter prospective decision criteria around the retrospective weak points', () => {
  const criteria = plan.primaryHouseDecisionRule.criteria;
  assert.equal(plan.primaryHouseDecisionRule.allRequired, true);
  assert.equal(criteria.memberWeightedBrierDeltaCapMinusBaselineMaximum, -0.0001);
  assert.equal(criteria.equalCaseBrierDeltaCapMinusBaselineMaximum, -0.0001);
  assert.equal(criteria.expectedCalibrationErrorDeltaCapMinusBaselineMaximum, 0);
  assert.equal(criteria.logLossDeltaCapMinusBaselineMaximum, 0.002);
  assert.equal(criteria.accuracyDeltaCapMinusBaselineMinimum, -0.002);
  assert.equal(criteria.absoluteMemberWeightedSignedResidualDeltaMaximum, 0);
  assert.equal(criteria.absoluteEqualCaseSignedResidualDeltaMaximum, 0);
  assert.equal(criteria.chamberMeanAbsoluteExpectedYesErrorDeltaMaximum, 0);
  assert.equal(plan.senateSafetyRule.requiredForGlobalPromotion, true);
});
