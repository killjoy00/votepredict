import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLL_TARGETS,MEMBERS,allowOriginalSources,memberRollFromOriginalText,auditJournal}
 from '../scripts/audit-senate-864-2023-bonding-original-journal-personal-votes.mjs';

function voteBlock(t,{namesYes='Housley Johnson Abeler Boldon',namesNo='Weber Wesenberg Bahr Duckworth',kind='passage',wrongBill=null}={}){
 const b=wrongBill||t.bill;
 const label=b.replace(/^HF/,'H.F. No. ');
 const intro=label+' was read the third time and placed on its final passage.\n'+
 (kind==='passage'?'The question was taken on the passage of the bill.':
  'The question was taken on the adoption of the motion.');
 return intro+'\nThe roll was called, and there were yeas '+t.yes+' and nays '+t.no+', as follows:\n'+
 'Those who voted in the affirmative were:\n'+namesYes+'\n'+
 'Pursuant to Rule 40, Senator Murphy cast the affirmative vote on behalf of the following Senators: Weber.\n'+
 'Those who voted in the negative were:\n'+namesNo+'\n'+
 'Pursuant to Rule 40, Senator Jasinski cast the negative vote on behalf of the following Senators: Johnson.\n'+
 'So the bill was '+(t.finalResult==='failed'?'not passed':'passed')+' and its title was agreed to.\n';
}
test('allow only 93rd Legislature original Senate day37/day77 Journal PDF URLs and exact counts',()=>{
 assert.equal(allowOriginalSources(),true);
 assert.deepEqual(ROLL_TARGETS.map(x=>[x.bill,x.day,x.yes,x.no]),[
  ['HF669','2023-03-16',33,32],['HF669','2023-05-22',56,11],['HF670','2023-05-22',35,14]]);
 assert.equal(MEMBERS.length,4);
});
test('four personally printed names are individually classified without using proxy-only mentions',()=>{
 const q=memberRollFromOriginalText('JOURNAL OF THE SENATE\n'+voteBlock(ROLL_TARGETS[0]),ROLL_TARGETS[0]);
 assert.equal(q.certifiedUniqueDirectPersonalRollCount,1);
 assert.deepEqual(q.certifiedUniqueDirectPersonalRoll.members.map(x=>x.personalRecordedThirdReadingChoice),
  ['YEA','YEA','NAY','NAY']);
 assert.equal(q.certifiedUniqueDirectPersonalRoll.members[2].appearsInPrintedAffirmativeRoster,false);
});
test('same yes/no counts under a different bill cannot be attached to HF669',()=>{
 const q=memberRollFromOriginalText(voteBlock(ROLL_TARGETS[0],{wrongBill:'HF999'}),ROLL_TARGETS[0]);
 assert.equal(q.certifiedUniqueDirectPersonalRollCount,0);
 assert.equal(q.aggregateRollCandidatesForThisTally[0].exactOriginalPrintedBillAnchor,'HF999');
});
test('a procedural motion with correct yes/no and bill anchor is not a final-passage ballot',()=>{
 const q=memberRollFromOriginalText(voteBlock(ROLL_TARGETS[0],{kind:'motion'}).replace(
  'was read the third time and placed on its final passage','was brought back to committee'),ROLL_TARGETS[0]);
 assert.equal(q.certifiedUniqueDirectPersonalRollCount,0);
});
test('individual name missing from both printed rosters must remain UNKNOWN even if proxy text mentions it',()=>{
 const q=memberRollFromOriginalText(voteBlock(ROLL_TARGETS[0],{namesNo:'Wesenberg Bahr Duckworth'}),ROLL_TARGETS[0]);
 assert.equal(q.certifiedUniqueDirectPersonalRollCount,0);
 assert.equal(q.aggregateRollCandidatesForThisTally[0].members.find(x=>x.senator==='Bill Weber').personalRecordedThirdReadingChoice,'UNKNOWN');
});
test('wrong bill nearest preceding the tally must fail even when correct HF669 appears earlier',()=>{
 const text='H.F. No. 669 was introduced.\n'+voteBlock(ROLL_TARGETS[0],{wrongBill:'HF670'});
 assert.equal(memberRollFromOriginalText(text,ROLL_TARGETS[0]).certifiedUniqueDirectPersonalRollCount,0);
});
test('multiple same tally and bill appearing independently creates ambiguity not fabricated one vote',()=>{
 const roll=voteBlock(ROLL_TARGETS[0]);
 const q=memberRollFromOriginalText(roll+'\n'+roll,ROLL_TARGETS[0]);
 assert.equal(q.certifiedUniqueDirectPersonalRollCount,0);
 assert.equal(q.uniquelyIdentifiedBillSpecificThirdReadingRollCount,0);
 assert.equal(q.certifiedDirectMemberChoiceCount,0);
 assert.equal(q.certifiedUniqueDirectPersonalRoll,null);
});
test('separate HF669/HF670 same day have separate bill-anchored named rolls',()=>{
 const journal=voteBlock(ROLL_TARGETS[1],{namesYes:'Johnson Housley Weber Wesenberg',namesNo:'Bahr Duckworth'})+
 voteBlock(ROLL_TARGETS[2],{namesYes:'Housley Johnson',namesNo:'Weber Wesenberg'});
 const a=memberRollFromOriginalText(journal,ROLL_TARGETS[1]);
 const b=memberRollFromOriginalText(journal,ROLL_TARGETS[2]);
 assert.equal(a.certifiedUniqueDirectPersonalRollCount,1);
 assert.equal(b.certifiedUniqueDirectPersonalRollCount,1);
 assert.deepEqual(a.certifiedUniqueDirectPersonalRoll.members.map(x=>x.personalRecordedThirdReadingChoice),['YEA','YEA','YEA','YEA']);
 assert.deepEqual(b.certifiedUniqueDirectPersonalRoll.members.map(x=>x.personalRecordedThirdReadingChoice),['YEA','YEA','NAY','NAY']);
});
test('government fetch failures and a non-PDF mime remain UNKNOWN not no votes',async()=>{
 const x=await auditJournal(ROLL_TARGETS,async()=>new Response('blocked',{status:503}));
 assert.equal(x.provenThirdReadingEventCount,0);
 assert.ok(x.primaryOriginalOfficialSenateJournalPdfs.every(p=>p.status==='ORIGINAL_PDF_OR_EXTRACTION_UNAVAILABLE_UNKNOWN'));
});
test('parse original PDF in memory only, pin full SHA and never claim author means YEA',async()=>{
 const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(27000)]);
 const x=await auditJournal(ROLL_TARGETS,async()=>new Response(pdf,{status:200,headers:{'content-type':'application/pdf'}}),
  async()=>({text:voteBlock(ROLL_TARGETS[0]),pages:18}));
 assert.equal(x.primaryOriginalOfficialSenateJournalPdfs.length,2);
 assert.ok(x.primaryOriginalOfficialSenateJournalPdfs.every(r=>/^[a-f0-9]{64}$/.test(r.wholeOriginalPdfSha256)));
 assert.equal(x.provenThirdReadingEventCount,1);
 assert.equal(x.senatorDecisionRowsEstablished,4);
 assert.equal(x.noOriginalPdfOrPageTextCommitted,true);
});

test('unique HF670 third-reading roll certifies two printed individual choices even when two other senators are absent',()=>{
 const t=ROLL_TARGETS[2];
 const x=memberRollFromOriginalText(voteBlock(t,{
   namesYes:'Abeler Bahr Bolliger Duckworth',
   namesNo:'Johnson Wesenberg Chamberlain'}),t);
 assert.equal(x.uniquelyIdentifiedBillSpecificThirdReadingRollCount,1);
 assert.equal(x.certifiedUniqueDirectPersonalRollCount,0);
 assert.equal(x.certifiedDirectMemberChoiceCount,2);
 assert.equal(x.countOfSampledMembersWhosePersonalChoiceRemainsUnknown,2);
 assert.deepEqual(x.independentlyCertifiedNamedMemberChoices.map(r=>[r.senator,r.choice]),[
   ['Mark T. Johnson','NAY'],['Nathan Wesenberg','NAY']]);
 assert.equal(x.ambiguityOrMissingRollCannotBecomeVote,undefined);
 assert.equal(x.ambiguousOrMissingRollCannotBecomeVote,true);
});
test('HF670 absent senator remains UNKNOWN, not automatic NAY even when other senators individually proved',()=>{
 const t=ROLL_TARGETS[2];
 const x=memberRollFromOriginalText(voteBlock(t,{namesYes:'Johnson Abeler',namesNo:'Wesenberg Bahr'}),t);
 assert.equal(x.certifiedDirectMemberChoiceCount,2);
 assert.deepEqual(x.independentlyCertifiedNamedMemberChoices.map(r=>r.choice),['YEA','NAY']);
 assert.ok(x.uniquelyIdentifiedBillSpecificThirdReadingRoll.members
   .filter(m=>['Karin Housley','Bill Weber'].includes(m.senator))
   .every(m=>m.personalRecordedThirdReadingChoice==='UNKNOWN'));
});
test('duplicate otherwise credible HF670 floor rolls prohibit every individual promotion',()=>{
 const t=ROLL_TARGETS[2],b=voteBlock(t,{
   namesYes:'Housley Weber Johnson',namesNo:'Wesenberg Bahr'});
 const x=memberRollFromOriginalText(b+'\n'+b,t);
 assert.equal(x.uniquelyIdentifiedBillSpecificThirdReadingRollCount,0);
 assert.equal(x.certifiedDirectMemberChoiceCount,0);
 assert.equal(x.countOfSampledMembersWhosePersonalChoiceRemainsUnknown,4);
});
