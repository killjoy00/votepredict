import assert from 'node:assert/strict';
import test from 'node:test';
import {
 SF910_2021_COMMITTEE_SOURCE as S,
 inspectOriginalSF9102021JournalCommitteeRoll,
 inspectFictionalSF9102021JournalCommitteeRoll
} from '../src/evidence/senate-2021-rule1210-sf910-original-journal-committee.js';
const YES=['FictionalAlpha','FictionalBravo','FictionalCharlie','FictionalDelta'];
const NO=['FictionalEcho','FictionalFoxtrot','FictionalGolf'];
function fixture(){
 return 'JOURNAL OF THE SENATE MONDAY, MARCH 8, 2021 '+
  ('Official fictitious test journal introduction. ').repeat(30)+
  'Senator Draheim from the Committee on Housing Finance and Policy, to which was referred '+
  'S.F. No. 910: A bill for a fictional act, referring building code rules. '+
  'Reports same back with recommendation that the bill be amended as follows: '+
  'Page 2, line 31, delete after effective. '+
  'And when so amended bill do pass and be re-referred to Committee on Labor and Industry Policy. '+
  'Amendments adopted. Report adopted. REPORT OF VOTE IN COMMITTEE '+
  'Pursuant to Rule 12.10, upon the request of three members, a roll call was taken '+
  'on the motion that S.F. No. 910, as amended, be recommended to pass and be re-referred. '+
  'There were yeas 4 and nays 3, as follows: Those who voted in the affirmative were: '+
  'Senators FictionalAlpha, FictionalBravo, FictionalCharlie, and FictionalDelta. '+
  'Those who voted in the negative were: Senators FictionalEcho, FictionalFoxtrot, and FictionalGolf. '+
  'The motion prevailed. '+('Other unrelated business. ').repeat(20);
}
const inspect=(txt=fixture())=>inspectFictionalSF9102021JournalCommitteeRoll(txt,YES,NO);
test('SF910 original Senate Housing COMMITTEE Rule12.10 report day is not original hearing day',()=>{
 assert.equal(S.version,'senate-2021-rule1210-sf910-original-journal-committee-4-3-v1');
 assert.equal(S.originalJournalURL,'https://www.senate.mn/journals/2021-2022/20210308021.pdf');
 assert.equal(S.journalReportDate,'2021-03-08');
 assert.equal(S.journalPage,714);
 assert.equal(S.journalDay,21);
 assert.equal(S.committee,'Housing Finance and Policy');
 assert.equal(S.originalPdfBinaryShaAuthenticatedByNewWorker,false);
 assert.equal(S.previouslyVerifiedDifferentBillWithSameSideIdentities,'SF1470');
 assert.equal(S.previouslyVerifiedDifferentBillJournalPage,666);
});
test('SF910 exact 4-3 named synthetic roll, without fabricated absent and no floor',()=>{
 const x=inspect();
 assert.deepEqual([x.bill,x.sourcePrintedYea,x.sourcePrintedNay,x.sourcePrintedAbsent],
  ['SF910',4,3,null]);
 assert.equal(x.originalSourceType,'OFFICIAL_SENATE_JOURNAL_2021_COMMITTEE_RULE1210_NOT_FLOOR');
 assert.equal(x.sourceMotionPrevailed,true);
 assert.equal(x.recordedMotion,'as amended recommend pass and re-refer');
 assert.ok(x.originalResultNormalizedTextOffset>x.originalMotionNormalizedTextOffset);
 assert.match(x.sourceMotionNeighborhoodSHA256,/^[a-f0-9]{64}$/);
 assert.match(x.sourceNamesIdentitySHA256Only.yea,/^[a-f0-9]{64}$/);
 assert.match(x.sourceNamesIdentitySHA256Only.nay,/^[a-f0-9]{64}$/);
 assert.equal(x.previousSF1470HasSameSideIdentitiesButDifferentBillAndMotion,true);
 assert.equal(x.hearingDateEstablishedByOriginalCommitteeMinutes,false);
 assert.equal(x.originalAbsentRowMissingNotZero,true);
 assert.equal(x.noStatewideCommitteeDenominator,true);
 assert.equal(x.noDatabaseMemberVoteImport,true);
});
test('authentic source path cannot certify invented names from fake suite',()=>{
 assert.throws(()=>inspectOriginalSF9102021JournalCommitteeRoll(fixture()),
  /authentic individually printed senator-side identity digest mismatch/);
});
test('fail closed on wrong SF and committee/date/mover and invented floor report',()=>{
 const base=fixture();
 for(const bad of [
  base.replace('S.F. No. 910','S.F. No. 911'),
  base.replace('Committee on Housing Finance and Policy','Committee on Finance'),
  base.replace('Senator Draheim','Senator FakeChair'),
  base.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF VOTE ON SENATE FLOOR'),
  base.replace('Pursuant to Rule 12.10','Pursuant to Floor Rule'),
  base.replace('MONDAY, MARCH 8, 2021','THURSDAY, MARCH 11, 2021'),
  base.replace('as amended, be recommended','be recommended'),
  base.replace('re-referred. There were','re-referred. After a later unrelated vote there were'),
  base.replace('There were yeas 4 and nays 3','There were yeas 5 and nays 2'),
  base.replace('The motion prevailed.','The motion failed.'),
  base.replace('FictionalDelta','FictionalAlpha')
 ])assert.throws(()=>inspect(bad));
});
test('two identical Rule12.10 SF910 votes in one source are rejected',()=>{
 const base=fixture();
 assert.throws(()=>inspect(base+' '+base.slice(base.indexOf('Pursuant to Rule 12.10'))),
  /not uniquely found/);
});
test('mock roster must be strictly fictional and exactly seven names',()=>{
 assert.throws(()=>inspectFictionalSF9102021JournalCommitteeRoll(fixture(),
  ['Dahms',...YES.slice(1)],NO),/fictitious test-only/);
});


test('real-style source PDF breaks affirmative roll at exact Journal p714 21st-day header',()=>{
 const x=fixture().replace(
  'Those who voted in the affirmative were: Senators FictionalAlpha',
  'Those who voted in the affirmative were: 714 JOURNAL OF THE SENATE [21ST DAY Senators FictionalAlpha');
 const row=inspect(x);
 assert.equal(row.sourcePrintedYea,4);
 assert.equal(row.sourcePrintedNay,3);
 assert.equal(row.previousSF1470HasSameSideIdentitiesButDifferentBillAndMotion,true);
 assert.throws(()=>inspect(x.replace('714 JOURNAL','715 JOURNAL')),
  /exact printed committee 4\/3/);
 assert.throws(()=>inspect(x.replace('21ST DAY','22ND DAY')),
  /exact printed committee 4\/3/);
});

test('SF910 exact journal p715 continuation survives pdf-parse page delimiting',()=>{
 const base=fixture();
 const seam=base.replace(
  'Those who voted in the affirmative were: Senators FictionalAlpha',
  'Those who voted in the affirmative were: -- 6 of 52 -- 21ST DAY] MONDAY, MARCH 8, 2021 715 Senators FictionalAlpha'
 );
 assert.equal(inspect(seam).sourcePrintedYea,4);
 for(const bad of [
  seam.replace('MARCH 8, 2021 715','MARCH 9, 2021 715'),
  seam.replace('MARCH 8, 2021 715','MARCH 8, 2021 716'),
  seam.replace('21ST DAY] MONDAY','20TH DAY] MONDAY'),
  seam.replace('Senators FictionalAlpha','Senators FictionalAlpha and an actual senator')
 ])assert.throws(()=>inspect(bad));
});

test('genuine redacted PDF structure reverses p714 running header after affirmative heading',()=>{
 const original=fixture();
 const authenticReverse=original.replace(
  'Those who voted in the affirmative were: Senators FictionalAlpha',
  'Those who voted in the affirmative were: [21ST DAY JOURNAL OF THE SENATE 714 -- 6 of 52 -- Senators FictionalAlpha'
 );
 assert.equal(inspect(authenticReverse).sourcePrintedYea,4);
 assert.equal(inspect(authenticReverse).sourcePrintedNay,3);
 for(const bad of [
  authenticReverse.replace('SENATE 714','SENATE 715'),
  authenticReverse.replace('[21ST DAY','[20TH DAY'),
  authenticReverse.replace('JOURNAL OF THE SENATE','JOURNAL OF THE HOUSE'),
  authenticReverse.replace('There were yeas 4 and nays 3','There were yeas 5 and nays 2'),
  authenticReverse.replace('Senators FictionalAlpha','Senators FictionalZulu')
 ])assert.throws(()=>inspect(bad));
});
