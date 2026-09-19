import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildQuickEvidenceFeatureVector,
  buildQuickEvidenceMemberShadow,
  QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
  type QuickEvidenceAvailabilityRow,
  type QuickEvidencePriorVoteRow,
  type QuickEvidenceStoredRow,
} from '../src/forecasting/quick-evidence-shadow.js';

function stored(overrides: Partial<QuickEvidenceStoredRow> = {}): QuickEvidenceStoredRow {
  return {
    id: 'evidence-1',
    membership_id: 'member-1',
    evidence_kind: 'direct_statement',
    stance: 'supports',
    source_quality: 'member_primary',
    relevance: 'direct',
    freshness: 'current',
    confidence: 0.98,
    published_at: '2027-02-01T12:00:00.000Z',
    source_kind: 'member_primary_article',
    fetched_at: '2027-02-01T12:30:00.000Z',
    metadata: {
      sourceVerified: true,
      quickEvidenceCandidate: true,
      mechanicallyActionable: false,
    },
    ...overrides,
  };
}

const availability: QuickEvidenceAvailabilityRow = {
  membership_id: 'member-1',
  total_items: 12,
  campaign_finance_items: 4,
  campaign_site_items: 2,
  member_primary_items: 3,
  news_items: 1,
  source_kinds: 5,
  newest_fetched_at: '2027-02-09T12:00:00.000Z',
};

test('candidate-only direct evidence can move the shadow without changing its non-serving status', () => {
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.5,
    evidenceRows: [stored()],
    availability,
    capturedAt: '2027-02-10T12:00:00.000Z',
    prospective: true,
  });
  assert.equal(shadow.servesTraffic, false);
  assert.equal(shadow.outcomeUseAtCapture, 'none');
  assert.ok((shadow.candidateProbability ?? 0) > 0.5);
  assert.equal(shadow.features.directSupport, 1);
  assert.equal(shadow.features.campaignFinanceItems, 4);
  assert.equal(shadow.features.newestEvidenceAgeDays, 1);
});

test('Quick Evidence clamps cumulative evidence movement to the frozen logit cap', () => {
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.5,
    evidenceRows: [
      stored({ id: 'one' }),
      stored({ id: 'two' }),
      stored({ id: 'three' }),
    ],
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.ok(shadow.uncappedLogitDelta > QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA);
  assert.equal(shadow.appliedLogitDelta, QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA);
  assert.ok((shadow.candidateProbability ?? 0) < 0.75);
});

test('opposing directional evidence offsets rather than being silently discarded', () => {
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.5,
    evidenceRows: [
      stored({ id: 'support' }),
      stored({ id: 'oppose', stance: 'opposes' }),
    ],
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.ok(Math.abs(shadow.appliedLogitDelta) < 1e-12);
  assert.equal(shadow.candidateProbability, 0.5);
  assert.equal(shadow.features.conflictingDirectionalEvidence, true);
});

test('prior official same-bill votes are part of the same unified evidence candidate', () => {
  const priorVotes: QuickEvidencePriorVoteRow = {
    membership_id: 'member-1',
    same_yes: 1,
    same_no: 0,
    companion_yes: 0,
    companion_no: 0,
    same_amendment_yes: 0,
    same_amendment_no: 0,
    same_motion_procedural_yes: 0,
    same_motion_procedural_no: 0,
    same_other_yes: 0,
    same_other_no: 0,
  };
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.5,
    priorVotes,
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.equal(shadow.features.priorSameBillYes, 1);
  assert.ok(shadow.appliedLogitDelta > 0);
  assert.ok((shadow.candidateProbability ?? 0) > 0.5);
});

test('prior same-bill non-passage votes are recorded but remain zero-weight pending validation', () => {
  const priorVotes: QuickEvidencePriorVoteRow = {
    membership_id: 'member-1',
    same_yes: 0,
    same_no: 0,
    companion_yes: 0,
    companion_no: 0,
    same_amendment_yes: 2,
    same_amendment_no: 1,
    same_motion_procedural_yes: 1,
    same_motion_procedural_no: 0,
    same_other_yes: 3,
    same_other_no: 2,
  };
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.61,
    priorVotes,
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.equal(shadow.features.priorSameBillAmendmentYes, 2);
  assert.equal(shadow.features.priorSameBillMotionProceduralYes, 1);
  assert.equal(shadow.features.priorSameBillOtherNo, 2);
  assert.equal(shadow.appliedEvidenceItems, 0);
  assert.ok(Math.abs((shadow.candidateProbability ?? 0) - 0.61) < 1e-12);
});

test('committee roll-call features are recorded but remain zero-weight pending validation', () => {
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.61,
    committeeVotes: {
      membership_id: 'member-1',
      recommend_aye: 1,
      recommend_nay: 0,
      referral_aye: 2,
      referral_nay: 0,
      hold_table_aye: 0,
      hold_table_nay: 1,
    },
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.equal(shadow.features.priorCommitteeRecommendAye, 1);
  assert.equal(shadow.features.priorCommitteeReferralAye, 2);
  assert.equal(shadow.features.priorCommitteeHoldTableNay, 1);
  assert.equal(shadow.appliedEvidenceItems, 0);
  assert.ok(Math.abs((shadow.candidateProbability ?? 0) - 0.61) < 1e-12);
});

test('reconstructed bill authorship is recorded but remains zero-weight pending validation', () => {
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.61,
    billAuthor: true,
    authorshipAvailable: true,
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.equal(shadow.features.billAuthor, true);
  assert.equal(shadow.features.authorshipAvailable, true);
  assert.equal(shadow.appliedEvidenceItems, 0);
  assert.ok(Math.abs((shadow.candidateProbability ?? 0) - 0.61) < 1e-12);
});

test('availability features are recorded but do not move probability by themselves', () => {
  const vector = buildQuickEvidenceFeatureVector({
    availability,
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.61,
    availability,
    capturedAt: '2027-02-10T12:00:00.000Z',
  });
  assert.equal(vector.totalEvidenceItems, 12);
  assert.equal(shadow.appliedEvidenceItems, 0);
  assert.ok(Math.abs((shadow.candidateProbability ?? 0) - 0.61) < 1e-12);
});


test('frozen unified Quick Evidence plan remains single-candidate and non-serving', () => {
  const plan = JSON.parse(readFileSync(
    new URL('../data/evaluation/quick-evidence-prospective-plan-v1.json', import.meta.url),
    'utf8',
  )) as Record<string, any>;
  assert.equal(plan.schemaVersion, 'quick-evidence-prospective-plan-v1');
  assert.equal(plan.scope.candidateVersion, 'quick-evidence-v1');
  assert.equal(plan.supersession.verifiedPreActivationState.quickRevisions, 0);
  assert.equal(plan.supersession.verifiedPreActivationState.oldProtocolCapturedRevisions, 0);
  assert.equal(plan.candidate.servesTraffic, false);
  assert.equal(plan.candidate.maxAbsoluteLogitDelta, 1);
  assert.equal(plan.amendment.verifiedPreActivationState.quickRevisions, 0);
  assert.equal(plan.amendment.verifiedPreActivationState.quickEvidenceCapturedRevisions, 0);
  assert.equal(plan.amendment.activeWeightChange, 'none');
  assert.ok(plan.capture.features.includes('priorSameBillAmendmentYes'));
  assert.ok(plan.capture.features.includes('priorSameBillMotionProceduralNo'));
  assert.ok(plan.capture.features.includes('priorSameBillOtherNo'));
  assert.ok(plan.capture.features.includes('billAuthor'));
  assert.ok(plan.capture.features.includes('authorshipAvailable'));
  assert.ok(plan.capture.features.includes('priorCommitteeRecommendAye'));
  assert.ok(plan.capture.features.includes('priorCommitteeRecommendNay'));
  assert.ok(plan.capture.features.includes('priorCommitteeReferralAye'));
  assert.ok(plan.capture.features.includes('priorCommitteeHoldTableNay'));
  assert.equal(plan.committeeMinutesAmendment.verifiedPreActivationState.quickRevisions, 0);
  assert.equal(plan.committeeMinutesAmendment.verifiedPreActivationState.quickEvidenceCapturedRevisions, 0);
  assert.equal(plan.committeeMinutesAmendment.activeWeightChange, 'none');
  assert.equal(plan.authorshipAmendment.verifiedPreActivationState.quickRevisions, 0);
  assert.equal(plan.authorshipAmendment.verifiedPreActivationState.quickEvidenceCapturedRevisions, 0);
  assert.equal(plan.authorshipAmendment.activeWeightChange, 'none');
  assert.equal(plan.capture.probabilityWriteToServingQuick, false);
  assert.equal(plan.guardrails.historicalWebBackfill, false);
  assert.equal(plan.guardrails.automaticPromotion, false);
});
