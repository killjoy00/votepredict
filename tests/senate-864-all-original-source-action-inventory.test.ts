import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSenate864AllSourceActionInventory} from
 '../src/evidence/senate-864-all-source-action-inventory.js';
const P='docs/evaluation/source-proof/';
const read=(p:string)=>JSON.parse(readFileSync(P+p,'utf8'));
const gaps=read('senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json');
const source={
 gaps,
 first2023:read('senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json'),
 later2023:read('senate-864-2023-fifty-original-clerk-three-run-union-receipts.json'),
 highGap:read('senate-864-three-high-gap-2024-25-original-source-receipts-v2.json'),
 other:read('senate-864-2022-24-25-other-24-original-clerk-two-run-source-receipts.json')
};
const originalSourceSha='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
function syntheticFullIndex(){
 const linked=[] as any[];
 const when=new Date('2022-01-01T12:00:00Z');
 let totals=0;
 for(let i=0;i<1451;i++){
  const day=new Date(when.getTime()+i*86400000).toISOString().slice(0,10);
  const year=Number(day.slice(0,4));
  const name='Fixture committee indexed '+i;
  const actions:any[]=[];
  if(i<104)actions.push({
   actionType:'named_roll_call',explicitlyNamedChoiceOccurrences:i<53?10:9
  });
  if(i<49)actions.push({actionType:'count_only_roll_call',explicitlyNamedChoiceOccurrences:0});
  // 883 linked days have at least one recognized action; 568 have zero.
  if(i>=104&&i<883)actions.push({actionType:'result_only',explicitlyNamedChoiceOccurrences:0});
  totals+=actions.filter(x=>x.actionType==='named_roll_call')
   .reduce((n,x)=>n+x.explicitlyNamedChoiceOccurrences,0);
  const original=(num:number)=>({
   sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/'+year+'/fixture/'+
    day.replaceAll('-','')+'/Fixture_'+num+'_Minutes.pdf',
   originalPdfSha256:(i*2+num+1).toString(16).padStart(64,'0'),
   ocrRecoveredFromInitiallyLowText:num===0&&(i<10||(i>=883&&i<1080)),
   sourceActions:num===0?actions:[]
  });
  linked.push({year,committee:name,hearingDate:day,status:'linked_originals_sha_authenticated',
   hasOriginalPdf:true,originalMinutes:i===0?[original(0),original(1)]:[original(0)],
   namedRollCandidates:i<104?1:0,countOnlyRollCandidates:i<49?1:0,
   namedChoiceOccurrences:actions.filter(x=>x.actionType==='named_roll_call')
    .reduce((n,x)=>n+x.explicitlyNamedChoiceOccurrences,0)});
 }
 assert.equal(totals,989);
 return {meetingCensusOriginalSha256:originalSourceSha,meetings:[
  ...linked,
  ...gaps.perOriginallyIndexedNoPdfMeeting.map((g:any)=>({
   year:g.year,committee:g.committeeName,hearingDate:g.hearingDate,
   status:'indexed_without_linked_minutes',hasOriginalPdf:false,
   originalMinutes:[],namedRollCandidates:null,countOnlyRollCandidates:null,
   namedChoiceOccurrences:null
  }))
 ]};
}
test('full original source audit conserves all 1592 LRL meeting days, 111 Clerk, orphan original and 29 holds',()=>{
 const report=buildSenate864AllSourceActionInventory({...source,indexed:syntheticFullIndex()});
 assert.equal(report.schemaVersion,'senate-864-all-known-2022-25-independent-original-motion-sources-v1');
 assert.deepEqual(report.years,[2022,2023,2024,2025]);
 assert.equal(report.officialIndexedMeetings,1592);
 assert.equal(report.officialLinkedOriginalPdfBodies,1452);
 assert.equal(report.originalClerkHtmlMinutes,111);
 assert.equal(report.otherOriginalArchivedMinutes,1);
 assert.equal(report.authenticatedWrittenMinutesMeetingDates,1563);
 assert.equal(report.indexedMeetingDatesStillWithoutWrittenMinutes,29);
 assert.equal(report.sourceExplicitNamedRollCandidatesInFrozenLinkedPdfs,104);
 assert.equal(report.sourceExplicitNamedRollCandidatesInCurrentLinkedPdfParserV3,112);
 assert.equal(report.sourceNamedRollsInNewClerkWrittenMinutes,27);
 assert.equal(report.linkedMinutesMeetingDatesWithoutAnyParserRecognizedAction,568);
 assert.equal(report.linkedOcrMeetingDatesWithoutAnyParserRecognizedAction,197);
 assert.equal(report.linkedEmbeddedTextMeetingDatesWithoutAnyParserRecognizedAction,371);
 assert.equal(report.linkedOriginalOcrRecoveredPdfBodies,207);
 assert.equal(report.missingActionReviewQueue.length,568);
 assert.equal(report.missingActionReviewQueue.filter(x=>x.reviewPriority===1).length,197);
 assert.ok(report.missingActionReviewQueue.every(x=>x.parserFindsZeroActionsButVotesNotInferredMissing));
 assert.equal(report.combinedCurrentNamedRollSourceCandidates,139);
 assert.equal(report.totalProvenOriginalNamedChoiceOccurrencesBeforeV3AddedRollChoices,1332);
 assert.equal(report.sumNonExhaustiveDistinctCohortSourceActionCandidates,273);
 assert.equal(report.otherOriginalClerkOutcomeTextCuesNotCertifiedMotions,10);
 assert.equal(report.additionalOrphanOfficialPdfMotionProposalsWithNoResult,2);
 assert.equal(report.perIndexedMeeting.length,1592);
 assert.equal(report.byYear.reduce((n,y)=>n+y.indexedMeetings,0),1592);
 assert.equal(report.byYear.reduce((n,y)=>n+y.missingOriginalWrittenMinutes,0),29);
 assert.equal(report.privateDbMemberVoteReconciliationPerformed,false);
 assert.equal(report.exactMissingPersistedVoteEventsOrMemberVotesKnown,false);
 assert.equal(report.safeToRerunLegacyPositionalBackfill,false);
 assert.equal(report.noNamedChoicesFromAttendanceVoiceOrCountOnly,true);
 const publicPayload=JSON.stringify(report);
 assert.doesNotMatch(publicPayload,/\"sourceName\"\s*:|normalized_member_name|choiceIdentitySha256|membership_id|postgresql:\/\//i);
});
test('source-only report differentiates named rolls from ambiguous voice, count, other cues and orphan proposals',()=>{
 const report=buildSenate864AllSourceActionInventory({...source,indexed:syntheticFullIndex()});
 const alt=report.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='authenticated_clerk_html');
 assert.equal(alt.length,111);
 assert.equal(alt.reduce((n,x)=>n+(x.namedRollCandidates??0),0),27);
 assert.equal(alt.reduce((n,x)=>n+(x.namedChoiceOccurrences??0),0),343);
 const omitted=report.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='unverified_written_minutes');
 assert.equal(omitted.length,29);
 assert.ok(omitted.every(x=>x.officialOriginalSha===null&&
  x.namedRollCandidates===null&&x.boundedOtherActionCandidates===null));
 const archived=report.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='authenticated_other_lrl_pdf');
 assert.equal(archived.length,1);
 assert.deepEqual([archived[0]?.year,archived[0]?.hearingDate,archived[0]?.namedRollCandidates],
  [2022,'2022-03-24',null]);
 assert.equal(report.perIndexedMeeting.some(x=>x.noVoteFromMissingSourceInferred),false);
});
test('a meeting absent from original source index, changed official HTML SHA or repeated identity cannot enter the ledger',()=>{
 const indexed=syntheticFullIndex();
 assert.throws(()=>buildSenate864AllSourceActionInventory({
  ...source,indexed:{...indexed,meetings:indexed.meetings.slice(1)}
 }),/Incomplete original indexed/);
 const changed={...source,
  highGap:{...source.highGap,everyOriginalMeeting:source.highGap.everyOriginalMeeting.map((x:any,i:number)=>
   i===0?{...x,senateClerkHtmlSha:'f'.repeat(64)}:x)}};
 assert.throws(()=>buildSenate864AllSourceActionInventory({...changed,indexed}),/Strict original/);
 const duplicate={...indexed,meetings:[...indexed.meetings.slice(0,-1),indexed.meetings[0]]};
 assert.throws(()=>buildSenate864AllSourceActionInventory({...source,indexed:duplicate}),/Duplicate government indexed/);
 const year2021={...indexed,meetings:[{...indexed.meetings[0],year:2021},...indexed.meetings.slice(1)]};
 assert.throws(()=>buildSenate864AllSourceActionInventory({...source,indexed:year2021}),/Outside official indexed/);
});
