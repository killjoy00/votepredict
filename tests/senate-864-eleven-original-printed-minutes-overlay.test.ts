import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrateSenate864SupplementaryLrlOriginalMinutes} from
 '../src/evidence/senate-864-2022-25-official-original-minutes-overlay.js';
import {integrateSenate864ElevenOriginalSameDayMinutes,
 type OriginalElevenMinuteReceipt} from
 '../src/evidence/senate-864-eleven-original-printed-minutes-overlay.js';
import type {buildSenate864AllSourceActionInventory} from
 '../src/evidence/senate-864-all-source-action-inventory.js';

type Base=ReturnType<typeof buildSenate864AllSourceActionInventory>;
const ROOT='docs/evaluation/source-proof/';
const load=(file:string)=>JSON.parse(readFileSync(ROOT+file,'utf8'));
const firstEight=load('senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json');
const eleven=load('senate-864-eleven-original-same-day-LRL-minutes-recovery.json') as OriginalElevenMinuteReceipt;
const gaps=load('senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json')
 .perOriginallyIndexedNoPdfMeeting;
function prior():ReturnType<typeof integrateSenate864SupplementaryLrlOriginalMinutes>{
 const rows:any[]=[];
 for(let i=0;i<1451;i++){
  const d=new Date(Date.UTC(2022,0,i+1)).toISOString().slice(0,10);
  rows.push({year:2022,committeeName:'Synthetic linked '+i,hearingDate:d,
   writtenMinuteClass:'official_index_linked_pdf',officialOriginalSha:'a'.repeat(64),
   namedRollCandidates:0,namedChoiceOccurrences:0});
 }
 for(const g of gaps)rows.push({
  year:g.year,committeeName:g.committeeName,hearingDate:g.hearingDate,
  writtenMinuteClass:g.originalClerkSha256?'authenticated_clerk_html':
   g.independentOrphanOfficialLrlPdfSource?'authenticated_other_lrl_pdf':
    'unverified_written_minutes',
  officialOriginalSha:g.originalClerkSha256||
   g.independentOrphanOfficialLrlPdfSource?.originalPdfSha256||null,
  namedRollCandidates:g.originalClerkSha256?0:null,
  namedChoiceOccurrences:g.originalClerkSha256?0:null
 });
 const original={
  officialIndexedMeetings:1592,authenticatedWrittenMinutesMeetingDates:1563,
  indexedMeetingDatesStillWithoutWrittenMinutes:29,
  byYear:[2022,2023,2024,2025].map((year,i)=>({
   year,archiveMinutesWithoutIndexLink:i===0?1:0,
   missingOriginalWrittenMinutes:[4,6,14,5][i]
  })),
  perIndexedMeeting:rows
 } as unknown as Base;
 return integrateSenate864SupplementaryLrlOriginalMinutes(original,firstEight);
}
test('government 30 PDF source batch recovers EXACTLY eleven SHA/printed-day Minutes, 1578/1592 coverage and 14 held dates',()=>{
 const r=integrateSenate864ElevenOriginalSameDayMinutes(prior(),eleven);
 assert.equal(r.originalArchivedPdfBodiesOutsideOriginalIndex,20);
 assert.equal(r.authenticatedWrittenMinutesMeetingDates,1578);
 assert.equal(r.indexedMeetingDatesStillWithoutWrittenMinutes,14);
 assert.equal(r.additionalPrintedSameDayOriginalMinutesMeetingDates,11);
 assert.equal(r.additionalPrintedSameDayOriginalPdfBodies,11);
 assert.equal(r.additionalContextParserOccurrencesNotDeduplicated,51);
 assert.deepEqual(r.byYear.map(y=>y.missingOriginalWrittenMinutes),[3,2,4,5]);
 assert.equal(r.perIndexedMeeting.length,1592);
 const added=r.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='authenticated_other_lrl_pdf'&&
  'additionalOriginalPdfBodies' in x&&x.additionalOriginalPdfBodies.length===1);
 assert.equal(added.length,11);
 assert.equal(new Set(added.map(x=>x.hearingDate+'|'+x.committeeName)).size,11);
 assert.ok(added.every(x=>x.namedRollCandidates===null&&x.namedChoiceOccurrences===null));
 assert.equal(r.sourceToActualVoteEventOrMemberVoteStoreStillNotReconciled,true);
 assert.equal(r.originalMinutesCoverageNotVoteEventCompleteness,true);
 assert.equal(JSON.stringify(r).includes('2021-'),false);
});
test('permanent receipt pins all original government byte/hash/source links and does not manufacture member-specific votes',()=>{
 assert.equal(eleven.originalDiagnosticRunId,38749557797);
 assert.equal(eleven.originalSources.length,11);
 assert.equal(eleven.originalSources.reduce((n,x)=>n+x.originalContextParserCandidates,0),51);
 assert.ok(eleven.originalSources.every(x=>x.firstPrintedDateFromOriginalHeader===x.hearingDate));
 assert.ok(eleven.originalSources.every(x=>x.originalNamedRollParserCandidates===0&&
  x.originalCountOnlyParserCandidates===0&&x.originalPrintedNamedChoiceOccurrences===0));
 assert.deepEqual(eleven.originalSourceArtifactProofs.map(x=>x.originalSameDayPrintedMinutes),[1,10,0]);
 const payload=JSON.stringify(eleven);
 assert.doesNotMatch(payload,/sourceMemberName|normalized_member_name|member_votes|membership_id|postgresql:/i);
});
test('wrong indexed meeting, forged PDF SHA, wrong day, 2021, duplicate and altered original Actions digest all HOLD',()=>{
 const initial=prior();
 const tamper=(fn:(r:OriginalElevenMinuteReceipt)=>void)=>{
  const candidate=structuredClone(eleven);fn(candidate);
  assert.throws(()=>integrateSenate864ElevenOriginalSameDayMinutes(initial,candidate));
 };
 tamper(r=>{r.originalSources[0]!.originalRawPdfSha256='garbled'});
 tamper(r=>{r.originalSources[0]!.originalSourceUrl='https://wrong-site.org/fake.pdf'});
 tamper(r=>{r.originalSources[0]!.firstPrintedDateFromOriginalHeader='2023-04-27'});
 tamper(r=>{r.originalSources[0]!.year=2021});
 tamper(r=>{r.originalSources[0]!.originalPrintedNamedChoiceOccurrences=10 as 0});
 tamper(r=>{r.originalSources[0]!.originalContextParserCandidates=70});
 tamper(r=>{r.originalSources[1]=r.originalSources[0]!});
 tamper(r=>{r.originalSourceArtifactProofs[0]!.originalZipSha256='0'.repeat(64)});
 const old=prior();
 const day=old.perIndexedMeeting.find(x=>x.year===2023&&x.committeeName==='Taxes'&&
  x.hearingDate==='2023-05-12');
 assert.ok(day);
 day.writtenMinuteClass='authenticated_clerk_html';
 assert.throws(()=>integrateSenate864ElevenOriginalSameDayMinutes(old,eleven));
});
