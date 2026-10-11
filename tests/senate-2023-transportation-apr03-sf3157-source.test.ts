import assert from 'node:assert/strict';
import test from 'node:test';
import {
 APR03_2023_SOURCE,normalizeOfficialMinutesHtml,
 inspectOfficialApr03SF3157,inspectSyntheticApr03SF3157
} from '../src/evidence/senate-2023-transportation-apr03-sf3157-source.js';

const FAKE=['Alfa','Bravo','Charlie','Delta','Echo',
 'Foxtrot','Golf','Hotel','India','Juliet'] as const;
const specs=[
 ['Jasinski','A28',8,0,2,true],
 ['Howe','A17',2,6,2,false],
 ['Jasinski','A20',5,4,1,true],
 ['Jasinski','A35',3,6,1,false],
 ['Howe','A30',3,5,2,false],
 ['Jasinski','A26',2,6,2,false],
 ['Howe','A49',2,6,2,false]
] as const;
function synthetic(){
 let html='<html><body><h1>Transportation Committee</h1>'+
  '<p>Monday, April 3, 2023</p><p>S.F.3157 omnibus committee amendments.</p>'+
  '<p>'+('Synthetic official-like markup. ').repeat(45)+'</p>';
 for(const [mover,label,y,n,a,adopted] of specs){
  const yes=FAKE.slice(0,y),no=FAKE.slice(y,y+n),absent=FAKE.slice(y+n);
  if(absent.length!==a)throw Error('fixture mistake');
  html+='<p>Senator '+mover+' moved the '+label+' amendment. ';
  if(label==='A49') html+='Senator Howe then moved the following oral amendment to the A49 amendment: insert text. Senator Howe requested a roll call on the proposed oral amendment. ';
  html+='The committee voted as follows:</p><ul>'+
   '<li>Yes: '+yes.join(', ')+'</li>'+
   '<li>No: '+(no.length?no.join(', '):'-')+'</li>'+
   '<li>Absent: '+absent.join(', ')+'</li></ul>'+
   '<p>With '+['zero','one','two','three','four','five','six','seven','eight','nine','ten'][y]+
   ' senators voting “yes” and '+
   ['zero','one','two','three','four','five','six','seven','eight','nine','ten'][n]+
   ' voting “no,” the motion did '+(adopted?'':'not ')+'prevail and the '+
   (label==='A49'?'A26':label)+' amendment was '+
   (adopted?'':'not ')+'adopted.</p>';
 }
 return html+'<p>'+('Fictional test-only conclusion. ').repeat(30)+'</p></body></html>';
}
const inspect=(html=synthetic())=>inspectSyntheticApr03SF3157(html,[...FAKE]);

test('the exact official source is committee / hearing / 2023, not Senate floor',()=>{
 assert.equal(APR03_2023_SOURCE.schemaVersion,
  'senate-2023-transportation-apr03-sf3157-official-html-seven-roll-source-v1');
 assert.equal(APR03_2023_SOURCE.date,'2023-04-03');
 assert.equal(APR03_2023_SOURCE.committee,'Transportation');
 assert.equal(APR03_2023_SOURCE.bill,'SF3157');
 assert.equal(APR03_2023_SOURCE.originalOfficialSenateHearingId,17939);
 assert.equal(APR03_2023_SOURCE.originalOfficialMinutesUrl,
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17939&ls=93&type=minutes');
 assert.throws(()=>inspectOfficialApr03SF3157(synthetic()),
  /full roster partition mismatch/);
});
test('seven distinct synthetic named original-roll sections and A49/A26 discrepancy retained',()=>{
 const proof=inspect();
 assert.equal(proof.records.length,7);
 assert.equal(proof.sixClearlyLabeledRollBlocks,6);
 assert.equal(proof.oneA49OralVersusA26PrintedLabelConflict,true);
 assert.deepEqual(proof.records.map(r=>r.printedMotionLabel),
  ['A28 amendment','A17 amendment','A20 amendment','A35 amendment','A30 amendment',
   'A26 amendment','A49 oral amendment']);
 assert.deepEqual(proof.records.map(r=>[r.namedYea,r.namedNay,r.namedAbsent]),
  [[8,0,2],[2,6,2],[5,4,1],[3,6,1],[3,5,2],[2,6,2],[2,6,2]]);
 assert.deepEqual(proof.records.map(r=>r.reportedResult),
  ['adopted','failed','adopted','failed','failed','failed','failed']);
 const a49=proof.records[6]!;
 assert.equal(a49.printedMover,'Howe');
 assert.equal(a49.actualConclusionPrintedLabel,'A26');
 assert.equal(a49.contradictoryMotionVersusConclusionLabel,true);
 assert.equal(a49.requiresManualReconciliationBeforeCountingDistinctVote,true);
 assert.equal(proof.records.filter(r=>r.contradictoryMotionVersusConclusionLabel).length,1);
 for(const r of proof.records){
  assert.equal(r.namedYea+r.namedNay+r.namedAbsent,10);
  assert.equal(r.sourceMemberIdentityHashesOnly.yea.length,r.namedYea);
  assert.equal(r.sourceMemberIdentityHashesOnly.nay.length,r.namedNay);
  assert.equal(r.sourceMemberIdentityHashesOnly.absent.length,r.namedAbsent);
  assert.equal(r.noOpeningRosterSubstitution,true);
  assert.equal(r.noIndividualMemberChoiceDatabaseImport,true);
  assert.equal(Object.values(r.sourceMemberIdentityHashesOnly).flat().every(v=>/^[a-f0-9]{64}$/.test(v)),true);
 }
 assert.equal(proof.noSourceEvidenceForVoiceVoteIndividualSides,true);
 assert.equal(proof.noRawNamedSideListStored,true);
 assert.equal(proof.noAutomaticModelOrMemberVoteImport,true);
});
test('source changing A49 outcome to A49 does not silently eliminate historical contradiction',()=>{
 const html=synthetic().replace(
  'voting “no,” the motion did not prevail and the A26 amendment was not adopted.</p>'+
  '<p>Fictional test-only conclusion',
  'voting “no,” the motion did not prevail and the A49 amendment was not adopted.</p>'+
  '<p>Fictional test-only conclusion');
 assert.throws(()=>inspect(html),/Unexpected \(or missing\) original amendment label conflict/);
});
test('missing, changed or duplicate named senator in a 2023 motion rejects any count',()=>{
 for(const edit of [
  (s:string)=>s.replace('Yes: Alfa, Bravo, Charlie','Yes: Alfa, Alfa, Charlie'),
  (s:string)=>s.replace('Absent: India, Juliet','Absent: India, Unlisted'),
  (s:string)=>s.replace('Yes: Alfa, Bravo, Charlie','Yes: Alfa, Bravo'),
  (s:string)=>s.replace('No: -','No: Alfa'),
 ]) assert.throws(()=>inspect(edit(synthetic())));
});
test('misassociated mover/roll, removed separate A49 oral text and wrong bill fail',()=>{
 for(const edit of [
  (s:string)=>s.replace('Senator Jasinski moved the A28 amendment','Senator Howe moved the A28 amendment'),
  (s:string)=>s.replace('oral amendment to the A49 amendment','statement about A49'),
  (s:string)=>s.replace('S.F.3157','S.F.9999')
 ]) assert.throws(()=>inspect(edit(synthetic())));
});
test('source cannot be interpreted as original with incorrect hearing date, committee, or fictional roster',()=>{
 assert.throws(()=>inspect(synthetic().replace('April 3, 2023','April 4, 2023')));
 assert.throws(()=>inspect(synthetic().replace('Transportation Committee','Health Committee')));
 assert.throws(()=>inspectSyntheticApr03SF3157(synthetic(),['Dibble',...FAKE.slice(1)]),
  /distinct fictional/);
 assert.throws(()=>inspectSyntheticApr03SF3157(synthetic(),['Alfa','Alfa',...FAKE.slice(2)]),
  /distinct fictional/);
});
test('markup normalization produces content only; source digest must be computed separately',()=>{
 const t=normalizeOfficialMinutesHtml('<p>A&amp;B</p><ul><li>Yes: Alfa</li></ul><script>attack()</script>');
 assert.ok(t.includes('A&B'));
 assert.ok(t.includes('Yes: Alfa'));
 assert.ok(!t.includes('attack()'));
});


test('original Senate HTML named typography &ldquo;/&rdquo; roundtrips before motion parsing',()=>{
 const encoded=synthetic().replace(/“/g,'&ldquo;').replace(/”/g,'&rdquo;');
 const text=normalizeOfficialMinutesHtml(encoded);
 assert.ok(text.includes('voting “yes”'));
 assert.ok(text.includes('voting “no,”'));
 const result=inspect(encoded);
 assert.equal(result.records.length,7);
 assert.deepEqual(result.records.map(r=>r.contradictoryMotionVersusConclusionLabel),
  [false,false,false,false,false,false,true]);
 assert.equal(result.records[0]!.namedNay,0);
 assert.equal(result.records[6]!.actualConclusionPrintedLabel,'A26');
});
