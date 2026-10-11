import test from 'node:test';
import assert from 'node:assert/strict';
import {
 THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS,
 RULE1210_2021_THREE_VERSION,
 inspectFictionalNew2021JournalCommitteeRoll,
 inspectAuthenticNew2021JournalCommitteeRoll
} from '../src/evidence/senate-2021-rule1210-sf2-sf566-sf1457-original.js';

const Y=['FictionalAlpha','FictionalBravo','FictionalCharlie','FictionalDelta',
 'FictionalEcho','FictionalFoxtrot','FictionalGolf'] as const;
const N=['FictionalHotel','FictionalIndia','FictionalJuliet'] as const;
type Bill='SF2'|'SF566'|'SF1457';
function fixture(bill:Bill){
 const x=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(s=>s.bill===bill)!;
 const day=x.journalDate==='2021-02-08'?'FEBRUARY 8, 2021':
  x.journalDate==='2021-02-17'?'FEBRUARY 17, 2021':'MARCH 10, 2021';
 const totalYes=Y.slice(0,x.yea),totalNo=N.slice(0,x.nay);
 const print=(v:readonly string[])=>v.length===1?v[0]:
  v.slice(0,-1).join(', ')+', and '+v.at(-1);
 const pre='JOURNAL OF THE SENATE '+day+
  (' Regular journal printed introductory proceedings unrelated to any committee or floor vote. ').repeat(12)+
  'Senator '+x.committeeReporter+' from the Committee on '+x.committee+
  ', to which was referred S.F. No. '+x.bill.slice(2)+
  ': A bill for an act relating to historical public state research. '+
  'Reports the same back with the recommendation that the bill be amended as follows: '+
  'Page 2, after line 4 insert a paragraph; and when so amended the bill do pass. '+
  'Amendments adopted. Report adopted. REPORT OF VOTE IN COMMITTEE ';
 const record='Pursuant to Rule 12.10, upon the request of three members, '+
  'a roll call was taken on the motion that S.F. No. '+x.bill.slice(2)+', '+
  (x.amended?'as amended, ':'')+'be recommended to pass'+
  (x.reReferralInRecordedMotion?' and be re-referred.':'.')+
  ' There were yeas '+x.yea+' and nays '+x.nay+', as follows: '+
  'Those who voted in the affirmative were: Senators '+print(totalYes)+'. '+
  'Those who voted in the negative were: Senator'+(x.nay===1?' ':'s ')+print(totalNo)+'. '+
  'The motion prevailed. ';
 return pre+record+('Introduction and first reading of unrelated bills. ').repeat(18);
}
function inspect(bill:Bill,txt=fixture(bill)){
 const x=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(s=>s.bill===bill)!;
 return inspectFictionalNew2021JournalCommitteeRoll(
  txt,bill,Y.slice(0,x.yea),N.slice(0,x.nay));
}
test('three 2021 Senate COMMITTEE official Journal source identities pinned to exact bills/pages',()=>{
 assert.equal(RULE1210_2021_THREE_VERSION,
  'senate-2021-committee-rule1210-sf2-sf566-sf1457-original-3-roll-v1');
 assert.deepEqual(THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.map(x=>
  [x.bill,x.journalDate,x.journalDay,x.journalPage,x.yea,x.nay,x.amended,x.reReferralInRecordedMotion]),[
   ['SF2','2021-02-08',11,268,5,3,true,true],
   ['SF566','2021-02-17',15,417,7,1,true,false],
   ['SF1457','2021-03-10',23,764,7,2,false,true]
  ]);
 assert.ok(THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.every(x=>
  x.journalPdfURL.startsWith('https://www.senate.mn/journals/2021-2022/')));
 assert.equal(THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS[0].previouslySHAAuthenticatedOriginalJournalPDF,
  'e4abf92f914c719dc440e947a683ed870b6ed9bdcddad3e3454d1b6b85794f4a');
});
for(const bill of ['SF2','SF566','SF1457'] as const){
 test(bill+' fictional named Rule12.10 committee roll exact partition passes without guessing absent',()=>{
  const r=inspect(bill);
  const spec=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(x=>x.bill===bill)!;
  assert.equal(r.bill,bill);
  assert.equal(r.printedYeaCount,spec.yea);
  assert.equal(r.printedNayCount,spec.nay);
  assert.equal(r.printedAbsentCount,null);
  assert.equal(r.sourceMemberSideHashesOnly.yea.length,spec.yea);
  assert.equal(r.sourceMemberSideHashesOnly.nay.length,spec.nay);
  assert.ok(r.sourceMemberSideHashesOnly.yea.every(s=>/^[a-f0-9]{64}$/.test(s)));
  assert.equal(r.passed,true);
  assert.equal(r.namedCommitteeRollNotSenateFloorVote,true);
  assert.equal(r.sourceOnlyJournalReportDateNotCommitteeMeetingDate,true);
  assert.equal(r.notAnOfficial2021PrintedCommitteeMinutesComparison,true);
  assert.equal(r.noSourceToDatabaseMemberVoteReconciliation,true);
  assert.equal(r.noIndividualVoteImport,true);
  assert.equal(r.noStatewide2021to2025CommitteeVoteDenominator,true);
 });
 test(bill+' real inspector rejects fictional side names',()=>{
  assert.throws(()=>inspectAuthenticNew2021JournalCommitteeRoll(fixture(bill),bill),
   /Unexpected historical individual YES\/NO choice side identity/);
 });
 test(bill+' rejects floor-style vote section and non-Rule12.10 report',()=>{
  assert.throws(()=>inspect(bill,fixture(bill).replace('REPORT OF VOTE IN COMMITTEE','SENATE FLOOR ROLL')),
   /not immediately under REPORT/);
  assert.throws(()=>inspect(bill,fixture(bill).replace('Pursuant to Rule 12.10','Pursuant to Rule 40')),
   /wrong SF\/version\/referral/);
 });
 test(bill+' rejects mutation of motion, tally, name, outcome and date',()=>{
  const base=fixture(bill),spec=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(s=>s.bill===bill)!;
  const mutations=[
   base.replace('The motion prevailed.','The motion did not prevail.'),
   base.replace('yeas '+spec.yea,'yeas '+(spec.yea-1)),
   base.replace('FictionalAlpha','FictionalOmega'),
   base.replace('REPORT OF VOTE IN COMMITTEE','REPORT OF SENATE FLOOR VOTE'),
   base.replace('Senator '+spec.committeeReporter,'Senator FictionalWrong'),
   base.replace('Committee on '+spec.committee,'Committee on Finance'),
   base.replace('2021','2022'),
   base.replace('S.F. No. '+spec.bill.slice(2)+', '+(spec.amended?'as amended, ':''),
    'S.F. No. 9999, ')
  ];
  for(const x of mutations)assert.throws(()=>inspect(bill,x));
 });
 test(bill+' same original roll repeated must not count as two votes',()=>{
  const s=fixture(bill);
  const after=s.slice(s.indexOf('Pursuant to Rule 12.10'));
  assert.throws(()=>inspect(bill,s+' '+after),/appears multiple times/);
 });
}
test('SF2 and Mar10 SF450 do not dedupe despite identical independently source-name-side digests',()=>{
 const sf2=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS[0];
 assert.equal(sf2.bill,'SF2');
 assert.equal(sf2.journalDate,'2021-02-08');
 // Independently downloaded earlier successful original SF450 artifact #11710021221
 // published exactly the same five YES and three NO SHA256 side identities.
 assert.equal(sf2.expectedYeaIdentityDigest,
  'e6753e6f7aa5a0e348cc370fc2e0f79a775a8003a80382d50c6c42861e6ef238');
 assert.equal(sf2.expectedNayIdentityDigest,
  'dd25cad1d1b0995360122b8e04709c0b1fb470cf03c95977380349f77d063c85');
 assert.equal(sf2.priorOriginalSF173SourceRunId,38160752446);
 assert.equal(sf2.reReferralInRecordedMotion,true);
});
test('mock inspector can only use fictional identities',()=>{
 assert.throws(()=>inspectFictionalNew2021JournalCommitteeRoll(fixture('SF2'),'SF2',
  ['Kiffmeyer',...Y.slice(1,5)],N),/fictional test-only/);
});
