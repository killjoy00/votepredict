import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  verifyHf100ConferenceSenateJournal,
  verifyHf100ConferenceOfficialFloorLog,
  validateHf100ConferenceSourceLedger,
  type HF100ConferenceSourceLedger,
} from '../src/evidence/minnesota-hf100-conference-source-verifier.js';

function pinnedLedger(): HF100ConferenceSourceLedger {
  return JSON.parse(readFileSync(
    new URL('../data/evaluation/senate-hf100-2023-conference-three-rolls-v1.json', import.meta.url),
    'utf8',
  )) as HF100ConferenceSourceLedger;
}
function ledger(): HF100ConferenceSourceLedger {
  // All original-source hashes stay permanently pinned in the file. Synthetic
  // short texts intentionally cannot impersonate the real 726,984-char report.
  const fixture = pinnedLedger();
  fixture.sourceJournal.embeddedConferenceReportTextSha256 = null;
  fixture.sourceJournal.embeddedConferenceReportNormalizedLength = null;
  return fixture;
}

const replacement = 'ARTICLE 1 REGULATION OF ADULT-USE CANNABIS Section 1. Office of Cannabis Management. '
  + 'Synthetic cannabis text section article regulatory definitions appropriation '.repeat(1900);
const journal = [
  'CONFERENCE COMMITTEE REPORT ON H. F. No. 100',
  'We, the undersigned conferees for H. F. No. 100, report that we have agreed upon the items in dispute.',
  'That the Senate recede from its amendments and that H. F. No. 100 be further amended as follows:',
  'Delete everything after the enacting clause and insert: "' + replacement + '"',
  'We request the adoption of this report and repassage of the bill.',
  'Senator Port moved that the foregoing recommendations and Conference Committee Report on H.F. No. 100 be now adopted, and that the bill be repassed as amended by the Conference Committee.',
  'Senator Rasmusson moved that the recommendations and Conference Committee Report on H.F. No. 100 be rejected and that the bill be re-referred to the Conference Committee as formerly constituted for further consideration.',
  'The question was taken on the adoption of the Rasmusson motion.',
  'The roll was called, and there were yeas 32 and nays 34, as follows:',
  'Those who voted in the affirmative were: names omitted in synthetic test.',
  'Those who voted in the negative were: names omitted in synthetic test.',
  'The motion did not prevail.',
  'The question recurred on the adoption of the Port motion.',
  'The roll was called, and there were yeas 34 and nays 32, as follows:',
  'Those who voted in the affirmative were: names omitted.',
  'Those who voted in the negative were: names omitted.',
  'The motion prevailed. So the recommendations and Conference Committee report were adopted.',
  'H.F. No. 100 was read the third time, as amended by the Conference Committee, and placed on its repassage.',
  'The question was taken on the repassage of the bill, as amended by the Conference Committee.',
  'The roll was called, and there were yeas 34 and nays 32, as follows:',
  'Those who voted in the affirmative were: names omitted.',
  'Those who voted in the negative were: names omitted.',
  'So the bill, as amended by the Conference Committee, was repassed and its title was agreed to.',
].join('\n');

const floorLog = [
  'SENATE BILL LOG: May 19, 2023 93rd Legislative Session Legislative Day: 74',
  '11:10 pm Motion to adopt the committee report on HF100 and the bill be repassed as amended by the committee (Port) NA',
  '11:13 pm Motion to reject the committee report of HF100 and re-refer it to the conference committee for further consideration (Rasmusson) Roll call- 32-34, failed',
  '12:45 am Motion to adopt the committee report on HF100 and the bill be repassed as amended by the committee (Port) Roll call- 34-32, adopted',
  '12:47 am Third reading of HF100 NA',
  '1:19 am Final passage of HF100 Roll call- 34-32, passed',
  '1:21 am Message from the House read',
].join('\n');

test('independent journal parser verifies THREE different named rolls on same HF100 conference report', () => {
  const output = verifyHf100ConferenceSenateJournal(journal, ledger());
  assert.equal(output.namedDivisionCount, 3);
  assert.deepEqual(output.talliesInOfficialJournalOrder, ['32-34', '34-32', '34-32']);
  assert.equal(output.separateConferenceDecisionCount, 3);
  assert.ok(output.actualConferenceReportReplacementTextLength > 100000);
  assert.match(output.actualConferenceReportReplacementTextSha256, /^[a-f0-9]{64}$/);
  assert.equal(output.reportVersionKeyExactMatchProven, false);
  assert.equal(output.independentlyVerifiedHistoricalPublicBy, null);
  assert.equal(output.protectedStoredEventParity, null);
});

test('separate clerk floor-log proof preserves post-midnight time and distinct report-adoption/final-repassage motions', () => {
  const output = verifyHf100ConferenceOfficialFloorLog(floorLog, ledger());
  assert.deepEqual(output.recordedClockTimes, ['11:13 pm', '12:45 am', '1:19 am']);
  assert.deepEqual(output.inferredCivilDates, ['2023-05-19', '2023-05-20', '2023-05-20']);
  assert.equal(output.reportAdoptionAndRepassageAreSeparateRecordedRolls, true);
  assert.equal(output.originalFloorLogTimesArePublishedByProof, false);
});

test('fake duplicate votes, wrong conference tallies and dropped original report text fail closed', () => {
  const lostRepassage = journal.replace(
    'The question was taken on the repassage of the bill, as amended by the Conference Committee.',
    'Final report approved again.',
  );
  assert.throws(() => verifyHf100ConferenceSenateJournal(lostRepassage, ledger()), /repassage question/);
  const wrongRasm = journal.replace('there were yeas 32 and nays 34', 'there were yeas 34 and nays 32');
  assert.throws(() => verifyHf100ConferenceSenateJournal(wrongRasm, ledger()), /named-roll/);
  const nonexistentReport = journal.replace('Delete everything after the enacting clause and insert:', 'Amend one word:');
  assert.throws(() => verifyHf100ConferenceSenateJournal(nonexistentReport, ledger()), /replace-all/);
  const wrongClock = floorLog.replace('12:45 am', '11:45 pm');
  assert.throws(() => verifyHf100ConferenceOfficialFloorLog(wrongClock, ledger()), /roll times/);
  const sameMotion = floorLog.replace('1:19 am Final passage', '1:19 am Adopt conference report');
  assert.throws(() => verifyHf100ConferenceOfficialFloorLog(sameMotion, ledger()), /cue mismatch/);
});

test('cannot certify invented CCR variant, same-day availability, wrong government URL or contradictory motion disposition', () => {
  const badOfficial = ledger();
  badOfficial.sourceJournal.url = 'https://example.invalid/journals/2023-2024/20230519074.pdf';
  assert.throws(() => validateHf100ConferenceSourceLedger(badOfficial), /identity/);
  const badVote = ledger();
  badVote.sourceActions[1].motionKind = 'repass_as_amended_by_conference';
  assert.throws(() => validateHf100ConferenceSourceLedger(badVote), /identity/);
  const badClock = ledger();
  badClock.sourceActions[2].calendarDateInference = '2023-05-19';
  assert.throws(() => validateHf100ConferenceSourceLedger(badClock), /identity/);
  const badRawSha = ledger();
  badRawSha.sourceJournal.pdfSha256 = 'empty';
  assert.throws(() => validateHf100ConferenceSourceLedger(badRawSha), /hash/);
  const badTextSha = ledger();
  badTextSha.sourceJournal.embeddedConferenceReportTextSha256 = 'f'.repeat(64);
  assert.throws(() => verifyHf100ConferenceSenateJournal(journal, badTextSha), /Previously SHA-pinned/);
});

test('two official originals and complete printed report text remain permanently pinned to verified independent source receipts', () => {
  const fixture = pinnedLedger();
  assert.equal(fixture.sourceJournal.pdfSha256, '58d5e75bfe0a2181957e69a2f9a70f8bdfc5d88414a8234cc89f438d3c730d25');
  assert.equal(fixture.sourceJournal.originalBytes, 10452382);
  assert.equal(fixture.sourceJournal.extractedTextSha256, '4612929e0aa374d8c583f8c573ceb3a410df6a279cb5bc31b7a515e21104a385');
  assert.equal(fixture.sourceJournal.embeddedConferenceReportTextSha256, 'd54bdb5cfd025ed02e8809c092a1fe9ed8e9d7b26386a9d2332aa047dce422ba');
  assert.equal(fixture.sourceJournal.embeddedConferenceReportNormalizedLength, 726984);
  assert.equal(fixture.sourceFloorLog.pdfSha256, 'c38ebfc43d8150742c44ee2541c596822a85757e3838de806bbdad8381e94c7e');
  assert.equal(fixture.sourceFloorLog.originalBytes, 96361);
  assert.equal(fixture.sourceFloorLog.extractedTextSha256, 'b1e5654d8fe7a06b381fc1c3f7414e7017d658f40f6b1cca6ac741c32b3bfdf7');
  assert.equal(fixture.sourceJournal.independentlyVerifiedPublicBy, null);
  assert.equal(fixture.sourceFloorLog.independentlyVerifiedPublicBy, null);
  validateHf100ConferenceSourceLedger(fixture);
});
