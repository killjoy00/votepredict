import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildPublicEvidenceProspectiveSnapshot,
  PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT,
  shouldCapturePublicEvidenceProspectiveSnapshot,
} from '../src/forecasting/public-evidence-prospective-capture';

const plan = JSON.parse(readFileSync(
  new URL('../data/evaluation/public-evidence-prospective-plan-v1.json', import.meta.url),
  'utf8',
)) as Record<string, any>;

test('public-evidence prospective capture is frozen to 2027 Quick decay-180 revisions', () => {
  assert.equal(shouldCapturePublicEvidenceProspectiveSnapshot({
    sessionSlug: '2027-2028',
    chamberSlug: 'house',
    researchMode: 'quick',
    modelVersion: 'member-eb-v1.2-decay180',
  }), true);
  assert.equal(shouldCapturePublicEvidenceProspectiveSnapshot({
    sessionSlug: '2025-2026',
    chamberSlug: 'house',
    researchMode: 'quick',
    modelVersion: 'member-eb-v1.2-decay180',
  }), false);
  assert.equal(shouldCapturePublicEvidenceProspectiveSnapshot({
    sessionSlug: '2027-2028',
    chamberSlug: 'senate',
    researchMode: 'deep',
    modelVersion: 'member-eb-v1.2-decay180',
  }), false);
  assert.equal(shouldCapturePublicEvidenceProspectiveSnapshot({
    sessionSlug: '2027-2028',
    chamberSlug: 'senate',
    researchMode: 'quick',
    modelVersion: 'member-eb-v1.1',
  }), false);
});

test('public-evidence snapshot records only availability and freshness, never a probability adjustment', () => {
  const snapshot = buildPublicEvidenceProspectiveSnapshot({
    membership_id: 'membership',
    total_items: 15,
    campaign_finance_items: 4,
    campaign_site_items: 3,
    member_primary_items: 5,
    news_items: 2,
    curated_items: 1,
    source_kinds: 5,
    newest_fetched_at: '2027-02-09T12:00:00.000Z',
  }, '2027-02-10T12:00:00.000Z');
  assert.equal(snapshot.experiment, PUBLIC_EVIDENCE_PROSPECTIVE_EXPERIMENT);
  assert.equal(snapshot.totalItems, 15);
  assert.equal(snapshot.hasAnyWebEvidence, true);
  assert.equal(snapshot.newestEvidenceAgeDays, 1);
  assert.equal(snapshot.mechanicallyActionable, false);
  assert.equal(snapshot.servesTraffic, false);
  assert.equal('yesProbability' in snapshot, false);
  assert.equal('probabilityAdjustment' in snapshot, false);
});

test('members without captured evidence still receive an explicit zero-evidence snapshot', () => {
  const snapshot = buildPublicEvidenceProspectiveSnapshot(undefined, '2027-02-10T12:00:00.000Z');
  assert.equal(snapshot.totalItems, 0);
  assert.equal(snapshot.sourceKinds, 0);
  assert.equal(snapshot.hasAnyWebEvidence, false);
  assert.equal(snapshot.newestFetchedAt, null);
  assert.equal(snapshot.newestEvidenceAgeDays, null);
});

test('prospective public-evidence plan forbids retrospective backfill and production movement', () => {
  assert.equal(plan.schemaVersion, 'public-evidence-prospective-plan-v1');
  assert.equal(plan.scope.session, '2027-2028');
  assert.equal(plan.scope.servingMemberModelVersion, 'member-eb-v1.2-decay180');
  assert.equal(plan.capture.textFeatures, false);
  assert.equal(plan.capture.stanceInference, false);
  assert.equal(plan.capture.probabilityWrite, false);
  assert.equal(plan.scoring.modelPromotionEligible, false);
  assert.equal(plan.guardrails.historicalBackfill, false);
  assert.equal(plan.guardrails.mechanicallyActionable, false);
  assert.equal(plan.guardrails.servingProbabilityChange, 'none');
  assert.equal(plan.guardrails.automaticPromotion, false);
});
