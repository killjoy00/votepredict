import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planSenateCommitteeHearingRepair,
  previewSenateCommitteeHearingRepairSql,
  senateCommitteeDurableNaturalKey,
  senateCommitteePersistedIdentityCompatible,
  type SenateCommitteeHistoricalEvidenceExportRow,
} from '../src/evidence/senate-committee-hearing-repair-plan.js';

const eid = '01111111-1111-4111-8111-111111111111';
const sid = '02222222-2222-4222-8222-222222222222';
const member = '03333333-3333-4333-8333-333333333333';
const bill = '04444444-4444-4444-8444-444444444444';
const url = 'https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230308/Fin_20230308_Minutes.pdf';
const day = '2023-03-08';

function evidence(
  overrides: Partial<SenateCommitteeHistoricalEvidenceExportRow> = {},
): SenateCommitteeHistoricalEvidenceExportRow {
  return {
    recordType: 'senate_committee_evidence',
    evidenceId: eid, sourceDocumentId: sid, sourceKind: 'senate_committee_minutes',
    sourceUrl: url, sourceSha256: 'a'.repeat(64),
    sourceMeetingDate: day, sourceOfficialArchive: 'true',
    itemMeetingDate: day, contextType: 'senate_committee_vote', subtype: 'named_roll_call',
    sourceVerified: 'true', publishedAt: null, meetingDateIsAvailability: 'false',
    asOfEligible: 'false', availableOn: null,
    mechanicallyActionable: 'false', modelWeight: '0', individualVotesAvailable: 'true',
    evidenceKind: 'fact', membershipId: member, billId: bill,
    ingestionIdentityKey: url + '|obs:0|member:' + member + '|choice:yea',
    ingestionKey: 'b'.repeat(64), associatedVoteEventDates: [day], ...overrides,
  };
}

test('source-proven legacy named committee vote is review-only eligible for hearing-date repair', () => {
  const plan = planSenateCommitteeHearingRepair([evidence()]);
  assert.equal(plan.reviewCandidates, 1);
  assert.equal(plan.alreadyCorrect, 0);
  assert.equal(plan.blocked, 0);
  assert.equal(plan.decisions[0]?.meetingDate, day);
  assert.equal(plan.decisions[0]?.meetingTimestampAfterRepair, '2023-03-08T23:59:59.999Z');
  assert.equal(plan.approvalRequiredBeforeAnyDatabaseWrite, true);
  assert.equal(plan.historicalAsOfRepairExecutionApproved, false);
  assert.equal(plan.privateProductionDataWasNotAccessedByPlanner, true);
});

test('already dated hearing evidence is not rewritten and source print year 2021 is excluded', () => {
  const correct = evidence({
    publishedAt: '2023-03-08T23:59:59.999Z',
    meetingDateIsAvailability: 'true', asOfEligible: 'true', availableOn: day,
  });
  assert.equal(planSenateCommitteeHearingRepair([correct]).decisions[0]?.disposition,
    'already_hearing_dated');
  const print = evidence({
    sourceUrl: url.replaceAll('2023', '2021').replaceAll('20230308', '20210308'),
    itemMeetingDate: '2021-03-08', sourceMeetingDate: '2021-03-08',
    associatedVoteEventDates: ['2021-03-08'],
  });
  assert.equal(planSenateCommitteeHearingRepair([print]).decisions[0]?.disposition,
    'blocked_source_provenance');
});

test('context-only voice and count-only actions have no invented individual membership votes', () => {
  const context = evidence({
    subtype: 'voice_vote', contextType: 'senate_committee_action', evidenceKind: 'context',
    membershipId: null, individualVotesAvailable: 'false', associatedVoteEventDates: [],
    ingestionIdentityKey: url + '|action:voice_vote|hash',
  });
  assert.equal(planSenateCommitteeHearingRepair([context]).reviewCandidates, 1);
  const count = evidence({
    subtype: 'count_only_roll_call', evidenceKind: 'context', membershipId: null,
    individualVotesAvailable: 'false',
    ingestionIdentityKey: url + '|obs:1|count:7-4',
  });
  assert.equal(planSenateCommitteeHearingRepair([count]).reviewCandidates, 1);
  const invented = evidence({
    subtype: 'count_only_roll_call', evidenceKind: 'context', membershipId: member,
    individualVotesAvailable: 'false',
  });
  assert.equal(planSenateCommitteeHearingRepair([invented]).decisions[0]?.disposition,
    'blocked_semantics');
});

test('wrong domain, wrong source year or wrong meeting day blocks automatic correction', () => {
  for (const input of [
    evidence({ sourceUrl: url.replace('www.lrl.mn.gov', 'www.lrl.mn.gov.evil.test') }),
    evidence({ sourceUrl: url.replace('/20230308/', '/20230309/') }),
    evidence({ sourceUrl: url.replace('/2023/', '/2025/') }),
    evidence({ sourceMeetingDate: '2023-03-09' }),
    evidence({ itemMeetingDate: '2023-03-10' }),
  ]) {
    assert.equal(planSenateCommitteeHearingRepair([input]).reviewCandidates, 0);
  }
});

test('missing proof or unsafe actionability never becomes review-approved', () => {
  const cases = [
    evidence({ sourceSha256: 'wrong' }),
    evidence({ sourceOfficialArchive: null }),
    evidence({ sourceVerified: 'false' }),
    evidence({ asOfEligible: 'true' }),
    evidence({ mechanicallyActionable: 'true' }),
    evidence({ modelWeight: '1' }),
    evidence({ ingestionKey: null }),
    evidence({ ingestionIdentityKey: null }),
    evidence({ associatedVoteEventDates: [] }),
    evidence({ associatedVoteEventDates: ['2023-03-08', '2023-03-09'] }),
    evidence({ publishedAt: '2026-10-10T00:00:00.000Z' }),
  ];
  for (const row of cases) {
    const plan = planSenateCommitteeHearingRepair([row]);
    assert.equal(plan.reviewCandidates, 0, JSON.stringify(row));
    assert.equal(plan.blocked, 1);
  }
});

test('legacy row plus new dated sibling is explicitly BLOCKED, never repaired or silently duplicated', () => {
  const old = evidence();
  const fixedSibling = evidence({
    evidenceId: '05555555-5555-4555-8555-555555555555',
    publishedAt: '2023-03-08T23:59:59.999Z',
    meetingDateIsAvailability: 'true', asOfEligible: 'true', availableOn: day,
    ingestionKey: 'c'.repeat(64),
  });
  const plan = planSenateCommitteeHearingRepair([old, fixedSibling]);
  assert.equal(plan.reviewCandidates, 0);
  assert.equal(plan.blocked, 2);
  assert.equal(plan.byDisposition.blocked_duplicate_natural_identity, 2);
});

test('future ingestion natural identity does not include mutable publication dates or claim contents', () => {
  const params = {
    sourceKind: 'senate_committee_minutes', sourceDocumentId: sid,
    ingestionIdentityKey: 'source|obs:0|member:' + member + '|choice:yea',
    evidenceKind: 'fact', membershipId: member, billId: bill,
  };
  const key = senateCommitteeDurableNaturalKey(params);
  assert.ok(key?.startsWith('senate-committee-v1|'));
  assert.equal(key, senateCommitteeDurableNaturalKey({ ...params }));
  assert.notEqual(key, senateCommitteeDurableNaturalKey({
    ...params, ingestionIdentityKey: 'source|obs:1|member:' + member + '|choice:yea',
  }));
  assert.equal(senateCommitteeDurableNaturalKey({ ...params, ingestionIdentityKey: null }), null);
  assert.equal(senateCommitteeDurableNaturalKey({ ...params, sourceKind: 'campaign_finance_bulk' }), null);
});

test('ingestion natural-key reuse checks unchanged source meaning and rejects silent position changes', () => {
  const persisted = {
    claim: 'Named committee YEA at official hearing', stance: 'neutral',
    extraction_method: 'deterministic-senate-committee-roll-call',
    extraction_version: 'mn-senate-committee-minutes-v2',
    context_type: 'senate_committee_vote', subtype: 'named_roll_call',
  };
  const draft = {
    claim: persisted.claim, stance: 'neutral',
    extractionMethod: persisted.extraction_method,
    extractionVersion: persisted.extraction_version,
    metadata: { contextType: persisted.context_type, subtype: persisted.subtype },
  };
  assert.equal(senateCommitteePersistedIdentityCompatible(persisted, draft), true);
  assert.equal(senateCommitteePersistedIdentityCompatible(persisted, {
    ...draft, claim: 'Claim changed after replay',
  }), false);
  assert.equal(senateCommitteePersistedIdentityCompatible(persisted, {
    ...draft, metadata: { ...draft.metadata, subtype: 'count_only_roll_call' },
  }), false);
});

test('preview SQL only targets source/date/identity-verified legacy evidence and ALWAYS rolls back', () => {
  const sql = previewSenateCommitteeHearingRepairSql([evidence()]);
  assert.ok(sql.includes('UPDATE evidence_items AS ei'));
  assert.ok(sql.includes('published_at ='));
  assert.ok(sql.includes("source_document_id = approved.source_document_id"));
  assert.ok(sql.includes("metadata->>'sourceVerified'"));
  assert.ok(sql.includes("metadata->>'ingestionIdentityKey'"));
  assert.ok(sql.includes('NOT EXISTS'));
  assert.ok(sql.includes('source_document_id = ei.source_document_id'));
  assert.ok(sql.includes("sameDayEligible', false"));
  assert.ok(sql.includes("metadata->>'modelWeight' = '0'"));
  assert.ok(sql.includes("'2023-03-08'"));
  assert.ok(sql.trimEnd().endsWith('ROLLBACK;'));
  assert.ok(!sql.includes('\nCOMMIT;'));
  assert.ok(!sql.includes('DELETE FROM evidence_items'));
  assert.ok(!sql.includes('INSERT INTO evidence_items'));
});

test('when export rows are absent, planner emits a no-op rollback and no invented rows', () => {
  const plan = planSenateCommitteeHearingRepair([]);
  assert.equal(plan.exportedRows, 0);
  assert.equal(plan.reviewCandidates, 0);
  assert.equal(plan.completeCommitteeMeetingAndVoteDenominatorsKnown, false);
  assert.equal(previewSenateCommitteeHearingRepairSql([]).trimEnd().endsWith('ROLLBACK;'), true);
});
