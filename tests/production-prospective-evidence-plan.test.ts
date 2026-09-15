import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PROSPECTIVE_EVIDENCE_CADENCE_HOURS,
  PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
  PROSPECTIVE_EVIDENCE_PLAN_VERSION,
  PROSPECTIVE_EVIDENCE_RESEARCH_MODE,
  PROSPECTIVE_EVIDENCE_SEED_LIMIT,
  PROSPECTIVE_EVIDENCE_SESSION,
  PROSPECTIVE_EVIDENCE_STARTING_MEMBER_MODEL_VERSION,
  prospectiveEvidenceTarget,
} from '../src/operations/prospective-evidence-plan.js';

const plan = JSON.parse(readFileSync(
  new URL('../data/evaluation/production-prospective-evidence-plan-v1.json', import.meta.url),
  'utf8',
)) as any;

test('prospective production evidence plan is frozen to the runtime constants', () => {
  assert.equal(plan.schemaVersion, PROSPECTIVE_EVIDENCE_PLAN_VERSION);
  assert.equal(plan.scope.session, PROSPECTIVE_EVIDENCE_SESSION);
  assert.equal(plan.scope.researchMode, PROSPECTIVE_EVIDENCE_RESEARCH_MODE);
  assert.equal(plan.scope.cadenceHours, PROSPECTIVE_EVIDENCE_CADENCE_HOURS);
  assert.equal(plan.scope.startingServingMemberModelVersion, PROSPECTIVE_EVIDENCE_STARTING_MEMBER_MODEL_VERSION);
  assert.equal(plan.cohort.ownerUserId, PROSPECTIVE_EVIDENCE_OWNER_USER_ID);
  assert.equal(plan.cohort.seedBatchLimit, PROSPECTIVE_EVIDENCE_SEED_LIMIT);
  assert.equal(plan.cohort.historicalBackfill, false);
  assert.equal(plan.guardrails.outcomeUseAtSeed, 'none');
  assert.equal(plan.guardrails.outcomeUseAtCapture, 'none');
  assert.equal(plan.guardrails.historicalOutcomeBackfill, 'forbidden');
  assert.equal(plan.guardrails.automaticPromotion, false);
  assert.equal(plan.scoring.sameDayRevisionEligible, false);
});

test('prospective target definitions are explicit for both chambers', () => {
  assert.deepEqual(prospectiveEvidenceTarget('house'), {
    targetKind: 'house_floor_passage',
    conditionalOn: 'a House floor vote',
  });
  assert.deepEqual(prospectiveEvidenceTarget('senate'), {
    targetKind: 'senate_floor_passage',
    conditionalOn: 'a Senate floor vote',
  });
});
