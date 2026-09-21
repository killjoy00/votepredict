import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  extractCurrentHouseCommitteeIds,
  extractProspectiveCommitteeRollcalls,
  minnesotaLegislatureForSessionStart,
  MN_HOUSE_COMMITTEE_ROLLCALL_MECHANICS,
  MN_HOUSE_COMMITTEE_ROLLCALL_PARSER,
} from '../src/evidence/minnesota-committee-rollcall.js';
import {
  buildQuickEvidenceMemberShadow,
  type QuickEvidenceStructuredPublicRow,
} from '../src/forecasting/quick-evidence-shadow.js';

const COMMITTEE_FEATURES = [
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

function zeroStructured(): QuickEvidenceStructuredPublicRow {
  return {
    membership_id: '11111111-1111-1111-1111-111111111111',
    floor_amendment_offers: 0,
    floor_amendment_wins: 0,
    conference_conferee: false,
    legislative_speech_items: 0,
    district_election_context_available: false,
    district_election_top_two_margin_pct: null,
    district_election_uncontested: null,
    bill_summary_items: 0,
    fiscal_note_items: 0,
    committee_recommends_passage_aye: 0,
    committee_recommends_passage_nay: 0,
    advances_toward_floor_eligibility_aye: 0,
    advances_toward_floor_eligibility_nay: 0,
    continues_committee_review_aye: 0,
    continues_committee_review_nay: 0,
    impedes_current_bill_progress_aye: 0,
    impedes_current_bill_progress_nay: 0,
    defers_current_bill_action_aye: 0,
    defers_current_bill_action_nay: 0,
    unclassified_committee_motion_aye: 0,
    unclassified_committee_motion_nay: 0,
  };
}

test('current House committee discovery stays scoped to the active legislature', () => {
  const html = [
    '<a href="/Committees/minutes/94001">Agriculture</a>',
    '<a href="/Committees/home/94020">Taxes</a>',
    '<a href="/Committees/minutes/93001">Old committee</a>',
    '<a href="/Committees/minutes/94001">Duplicate</a>',
  ].join('\n');
  assert.equal(minnesotaLegislatureForSessionStart(2025), 94);
  assert.equal(minnesotaLegislatureForSessionStart(2027), 95);
  assert.deepEqual(extractCurrentHouseCommitteeIds(html, 94), ['94001', '94020']);
});

test('prospective extraction reuses frozen parser v2 and mechanics taxonomy', () => {
  assert.equal(MN_HOUSE_COMMITTEE_ROLLCALL_PARSER, 'deterministic-house-committee-roll-call-v2');
  assert.equal(MN_HOUSE_COMMITTEE_ROLLCALL_MECHANICS, 'mn-house-procedural-mechanics-v1');

  const html = [
    '<p>Representative Alpha moved that HF100 be recommended to pass and re-referred to the Committee on Taxes.</p>',
    '<p>A roll call was taken.</p>',
    '<p>AYES</p>',
    '<p>Alpha, Alice</p>',
    '<p>NAYS</p>',
    '<p>Beta, Bob</p>',
    '<p>The motion prevailed.</p>',
    '<p>Representative Alpha moved the A1 amendment to HF100.</p>',
    '<p>AYES</p>',
    '<p>Alpha, Alice</p>',
    '<p>NAYS</p>',
    '<p>Beta, Bob</p>',
  ].join('\n');

  const result = extractProspectiveCommitteeRollcalls({
    html,
    bills: [{ billId: 'bill-100', identifier: 'HF100' }],
    members: [
      { membershipId: 'm-alice', memberName: 'Alice Alpha' },
      { membershipId: 'm-bob', memberName: 'Bob Beta' },
    ],
  });

  assert.equal(result.observations.length, 2);
  const aye = result.observations.find((row) => row.membershipId === 'm-alice');
  const nay = result.observations.find((row) => row.membershipId === 'm-bob');
  assert.equal(aye?.voteSide, 'aye');
  assert.deepEqual(aye?.mechanics, ['committee_recommends_passage', 'continues_committee_review']);
  assert.equal(nay?.voteSide, 'nay');
  assert.deepEqual(nay?.mechanics, ['committee_recommends_passage', 'continues_committee_review']);
  assert.equal(result.observations.some((row) => /amendment/i.test(row.motionText)), false);
});

test('prospective protocol adds committee fields only after verified zero activation state', () => {
  const plan = JSON.parse(
    readFileSync('data/evaluation/quick-evidence-prospective-plan-v1.json', 'utf8'),
  ) as {
    capture: { features: string[] };
    committeeRollcallAmendment: {
      parser: string;
      mechanicsTaxonomy: string;
      asOfPolicy: string;
      verifiedPreActivationState: {
        session: string;
        quickRevisions: number;
        quickEvidenceCapturedRevisions: number;
      };
      servingProbabilityChange: string;
      activeWeightChange: string;
      automaticPromotion: boolean;
    };
  };
  for (const feature of COMMITTEE_FEATURES) assert.ok(plan.capture.features.includes(feature));
  assert.equal(plan.committeeRollcallAmendment.parser, 'deterministic-house-committee-roll-call-v2');
  assert.equal(plan.committeeRollcallAmendment.mechanicsTaxonomy, 'mn-house-procedural-mechanics-v1');
  assert.match(plan.committeeRollcallAmendment.asOfPolicy, /strictly before/i);
  assert.deepEqual(plan.committeeRollcallAmendment.verifiedPreActivationState, {
    session: '2027-2028',
    quickRevisions: 0,
    quickEvidenceCapturedRevisions: 0,
    verifiedOn: '2026-09-21',
  });
  assert.equal(plan.committeeRollcallAmendment.servingProbabilityChange, 'none');
  assert.equal(plan.committeeRollcallAmendment.activeWeightChange, 'none');
  assert.equal(plan.committeeRollcallAmendment.automaticPromotion, false);
});

test('committee roll-call features are recorded at zero directional weight', () => {
  const structured = zeroStructured();
  structured.committee_recommends_passage_aye = 2;
  structured.continues_committee_review_aye = 2;
  structured.advances_toward_floor_eligibility_nay = 1;

  const shadow = buildQuickEvidenceMemberShadow({
    baseProbability: 0.4,
    structuredPublic: structured,
    capturedAt: '2027-02-10T12:00:00.000Z',
    prospective: true,
  });

  assert.equal(shadow.appliedEvidenceItems, 0);
  assert.equal(shadow.uncappedLogitDelta, 0);
  assert.equal(shadow.appliedLogitDelta, 0);
  assert.ok(Math.abs((shadow.candidateProbability ?? 0) - 0.4) < 1e-12);
  assert.equal(shadow.features.committeeRecommendsPassageAye, 2);
  assert.equal(shadow.features.continuesCommitteeReviewAye, 2);
  assert.equal(shadow.features.advancesTowardFloorEligibilityNay, 1);
});
