import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspect2023RulesJanuary24OriginalNamedRolls,
 RULES_2023_JAN24_ORIGINAL} from
 '../src/evidence/senate-864-2023-rules-jan24-original-rolls.js';
const source=RULES_2023_JAN24_ORIGINAL;
const who=['Arbor','Birch','Cedar','Dahlia','Elm','Fir','Grove','Holly','Iris','Juniper'];
const list=(people:readonly string[])=>people.map(s=>'Senator '+s).join(' ');
const firstYes=who.slice(0,4),firstNo=who.slice(4);
const secondYes=who.slice(4),secondNo=who.slice(0,4);
function fixture(){
 return [
  'Minnesota Senate Rules and Administration Committee  January 24, 2023.',
  'The committee considered the committee report for Senate File 1. Lead Johnson',
  'offered an oral amendment. Lead Johnson moved to amend the committee report.',
  'After “do pass” add “and be re-referred to the Committee on Health and Human Services”.',
  'Senator Birch requested a roll call. A roll call was granted.',
  'Members voting AYE: '+list(firstYes),
  'Members voting NO: '+list(firstNo),
  'On a vote of 4 AYE, and 6 NO, THE AMENDMENT WAS NOT ADOPTED.',
  'Senator Cedar moved to adopt the committee on Judiciary and Public Safety’s',
  'committee report for Senate File 1. Lead Johnson requested a roll call.',
  'A roll call was granted. -- 1 of 2 --',
  'Members voting AYE: '+list(secondYes),
  'Members voting NO: '+list(secondNo),
  'On a vote of 6 AYE, and 4 NO, the committee report was adopted.',
  'The meeting was adjourned at 11:51 am.'
 ].join('\n');
}
const a=(text:string)=>inspect2023RulesJanuary24OriginalNamedRolls({
 text,originalPdfSha256:source.originalPdfSha256,
 hearingDate:source.hearingDate,committeeName:source.committeeName
});
test('source-only original Rules Jan24 independently identifies two different SF1 original parliamentary motions and twenty explicit sides',()=>{
 const report=a(fixture());
 assert.equal(report.status,'named_lists_exact_and_uniquely_counted');
 assert.equal(report.originalSourceOfficialMotionCount,2);
 assert.equal(report.originalNamedRollCandidatesVerified,2);
 assert.equal(report.exactNamedChoicesSourceVerified,20);
 assert.deepEqual(report.originalIndependentlyPrintedTallyLabels,[{yea:4,nay:6},{yea:6,nay:4}]);
 assert.deepEqual(report.actionRows.map(r=>r.originalMotionDisposition),['failed','adopted']);
 assert.equal(report.actionRows[0]!.sourceMotion,'SF1_oral_committee_report_amendment');
 assert.equal(report.actionRows[1]!.sourceMotion,'SF1_judiciary_committee_report_adoption');
 assert.equal(report.notYetComparedToHistoricalSenateMembershipOrStoredEvents,true);
 assert.equal(report.notSafeToReplayOldPositionalImporter,true);
 assert.equal(report.databaseWrites,false);
 assert.doesNotMatch(JSON.stringify(report),/\\bArbor\\b|\\bBirch\\b|sourceMemberName|choiceIdentitySha256|membership_id/i);
});
test('same senators may vote different sides on two motions; a repeated roster is not a stable action key',()=>{
 const text=fixture().replace('Members voting AYE: '+list(secondYes),
  'Members voting AYE: '+list(firstYes)).replace('Members voting NO: '+list(secondNo),
  'Members voting NO: '+list(firstNo));
 const report=a(text);
 assert.equal(report.originalSourceOfficialMotionCount,2);
 assert.equal(report.exactNamedChoicesSourceVerified,20);
});
test('aggregate tallies without independently parseable members produce only explicit naming grammar HOLD',()=>{
 const bad=fixture().replace('Members voting AYE: '+list(firstYes),
  'Members voting AYE: [names unreadable]');
 const report=a(bad);
 assert.equal(report.status,'source_roll_printed_names_grammar_hold');
 assert.equal(report.originalNamedRollCandidatesVerified,1);
 assert.equal(report.exactNamedChoicesSourceVerified,10);
 assert.equal(report.actionRows[0]!.sourceNamedMemberChoices,null);
 assert.equal(report.actionRows[0]!.originalSideNamesCountVerified,false);
});
test('original byte SHA, original committee/day, two specific motion outcomes, and unambiguous numeric tallies all required',()=>{
 assert.throws(()=>inspect2023RulesJanuary24OriginalNamedRolls({
  text:fixture(),originalPdfSha256:'0'.repeat(64),
  hearingDate:source.hearingDate,committeeName:source.committeeName
 }),/Exact 2023 Rules original/);
 assert.throws(()=>inspect2023RulesJanuary24OriginalNamedRolls({
  text:fixture(),originalPdfSha256:source.originalPdfSha256,
  hearingDate:'2021-01-24',committeeName:source.committeeName
 }),/Exact 2023 Rules original/);
 assert.throws(()=>a(fixture().replace('THE AMENDMENT WAS NOT ADOPTED','MOTION PASSED')),
  /motion, roll-call request, or outcome/);
 assert.throws(()=>a(fixture().replace('On a vote of 4 AYE, and 6 NO','On a vote of 3 AYE, and 7 NO')),
  /mismatched totals/);
 assert.throws(()=>a(fixture().replace('Members voting NO:', 'All members present:')),
  /two independently labeled/);
});
test('live Senate committee importer is unchanged and this original review cannot write to source or member_votes',()=>{
 const old=readFileSync('scripts/backfill-senate-committee-minutes.ts','utf8');
 assert.match(old,/externalKey=\x60senate-committee:\$\{sourceKey\}:\$\{observationIndex\}\x60/);
 const review=readFileSync('src/evidence/senate-864-2023-rules-jan24-original-rolls.ts','utf8');
 assert.doesNotMatch(review,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/i);
 assert.equal(source.originalPdfSha256.length,64);
 assert.equal(source.year,2023);
});
