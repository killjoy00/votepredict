import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditSenateCommitteeOriginalMinutePdf,
} from '../src/evidence/senate-committee-original-pdf-action-audit.js';
import type {
  FetchedSenateCommitteeMinute,
  SenateCommitteeMinuteDocument,
} from '../src/evidence/minnesota-senate-committee-source.js';

const day = '2024-03-06';
const url = 'https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf';
function document(overrides: Partial<SenateCommitteeMinuteDocument> = {}): SenateCommitteeMinuteDocument {
  return { year: 2024, committeeName: 'Finance', meetingDate: day, url, ...overrides };
}
function pdf(text: string): FetchedSenateCommitteeMinute {
  return {
    text, bytes: 30333, contentSha256: 'a'.repeat(64),
    httpStatus: 200, fetchedAt: '2026-10-10T15:00:00.000Z',
    extractionMethod: 'embedded_text',
  };
}

test('original named 4-6 roll is source keyed and not mislabeled final passage stance', () => {
  const body = [
    '<h2>Finance Committee</h2>',
    '<p>S.F. 5430 was before the committee.</p>',
    '<p>Senator Limmer moved the A10 amendment and requested a roll call vote. ',
    '4/6 (Ayes: Johnson, Eichorn, Limmer, Miller; Nays: Murphy, Rest, Champion, Frentz, Marty, Pappas) ',
    'MOTION FAILED</p>',
  ].join('');
  const audit = auditSenateCommitteeOriginalMinutePdf({ document: document(), pdf: pdf(body) });
  assert.equal(audit.sourceParserTotals.namedRollCalls, 1);
  assert.equal(audit.sourceParserTotals.countOnlyRollCalls, 0);
  assert.equal(audit.sourceParserTotals.namedMemberChoicesInPdf, 10);
  assert.equal(audit.voteObservations[0]?.billIdentifier, 'SF5430');
  assert.equal(audit.voteObservations[0]?.amendmentRef, 'A10');
  assert.equal(audit.voteObservations[0]?.yeaCount, 4);
  assert.equal(audit.voteObservations[0]?.nayCount, 6);
  assert.equal(audit.voteObservations[0]?.finalPassageStanceInferred, false);
  const expected = 'senate-committee:'
    + createHash('sha256').update(url).digest('hex').slice(0, 16) + ':0';
  assert.equal(audit.voteObservations[0]?.externalKey, expected);
  assert.equal(audit.document.meetingDate, day);
  assert.equal(audit.timing.sameDayEligible, false);
  assert.equal(audit.originalPdfTextPersisted, false);
  assert.equal(audit.privateDatabaseAccess, false);
  assert.ok(!JSON.stringify(audit).includes('Senator Limmer moved'));
  assert.ok(!JSON.stringify(audit).includes('Murphy, Rest'));
});

test('unattributed voice vote and unanimous or result-only motions never fabricate member choices', () => {
  const body = [
    '<p>S.F. 4784 was before the committee.</p>',
    '<p>Senator Frentz moved the A4 amendment. It was adopted via voice vote.</p>',
    '<p>S.F. 2200 was before the committee.</p>',
    '<p>Senator Doe moved that S.F. 2200 be recommended to pass.</p>',
    '<p>The motion prevailed unanimously.</p>',
    '<p>S.F. 3300 was before the committee.</p>',
    '<p>Senator Doe moved the A2 amendment.</p>',
    '<p>The motion failed.</p>',
  ].join('');
  const r = auditSenateCommitteeOriginalMinutePdf({ document: document(), pdf: pdf(body) });
  assert.equal(r.sourceParserTotals.namedMemberChoicesInPdf, 0);
  assert.equal(r.sourceParserTotals.namedRollCalls, 0);
  assert.ok(r.sourceParserTotals.contextOnlyActions >= 2);
  assert.equal(r.contextOnlyActions.every(x => x.individualVotesAvailable === false), true);
  assert.equal(r.contextOnlyActions.every(x => x.finalPassageStanceInferred === false), true);
  assert.equal(r.missingness.completeVoteDenominatorCertified, false);
});

test('generic roll-call cue with no supported pattern is flagged for review, not asserted no vote', () => {
  const sample = pdf(
    'A call of the committee was made. Senators had a roll call and some answered. '
      + 'The source discusses a committee vote but did not record recognized lists or tallies.');
  const audit = auditSenateCommitteeOriginalMinutePdf({ document: document(), pdf: sample });
  assert.equal(audit.sourceParserTotals.namedRollCalls, 0);
  assert.equal(audit.missingness.possibleUnparsedRollCallSignal, true);
  assert.equal(audit.missingness.noSupportedDetectionDoesNotProveNoRecordedAction, true);
  assert.equal(audit.missingness.completeVoteDenominatorCertified, false);
});

test('scope and source hash must be exact: no House, 2021 print-only or spoofed LRL domains', () => {
  for (const src of [
    document({ year: 2021, url: url.replaceAll('2024', '2021') }),
    document({ url: url.replace('/senate/', '/house/') }),
    document({ url: url.replace('www.lrl.mn.gov', 'www.lrl.mn.gov.evil.test') }),
    document({ meetingDate: '2024-03-07' }),
    document({ url: url.replace('/20240306/', '/20240307/') }),
  ]) {
    assert.throws(() => auditSenateCommitteeOriginalMinutePdf({
      document: src, pdf: pdf('Official committee roll call 4/6.'),
    }), /official Minutes PDF/);
  }
  assert.throws(() => auditSenateCommitteeOriginalMinutePdf({
    document: document(), pdf: { ...pdf('Official committee vote source'), contentSha256: 'bad' },
  }), /provenance/);
});

test('calendar day timestamp represents only a day-level event, not an intraday timestamp', () => {
  const audit = auditSenateCommitteeOriginalMinutePdf({
    document: document(), pdf: pdf(
      'Minnesota Senate Finance Committee March 6, 2024. Committee meeting adjourned.'),
  });
  assert.equal(audit.timing.availableOn, day);
  assert.equal(audit.timing.dateGranularity, 'day');
  assert.equal(audit.timing.intradayOrderingProven, false);
  assert.equal(audit.timing.asOfEligible, true);
  assert.equal(audit.timing.historicalAsOfEligibilityInPersistedDatabaseUnverified, true);
  assert.equal(audit.missingness.noSupportedVoteOrActionDetected, true);
  assert.equal(audit.missingness.noSupportedDetectionDoesNotProveNoRecordedAction, true);
});
