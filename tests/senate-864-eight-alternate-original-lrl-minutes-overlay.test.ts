import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrateSenate864SupplementaryLrlOriginalMinutes,
 type SupplementaryMinutes} from
 '../src/evidence/senate-864-2022-25-official-original-minutes-overlay.js';
import type {buildSenate864AllSourceActionInventory} from
 '../src/evidence/senate-864-all-source-action-inventory.js';
type Original=ReturnType<typeof buildSenate864AllSourceActionInventory>;
const receipt=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json','utf8')
) as SupplementaryMinutes;
const gaps=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json','utf8')
).perOriginallyIndexedNoPdfMeeting;
function original():Original{
 const extra=1451;
 const rows:any[]=[];
 for(let i=0;i<extra;i++){
  const d=new Date(Date.UTC(2022,0,i+1)).toISOString().slice(0,10);
  rows.push({year:2022,committeeName:'Mock linked '+i,hearingDate:d,
   writtenMinuteClass:'official_index_linked_pdf',officialOriginalSha:'a'.repeat(64),
   namedRollCandidates:0,namedChoiceOccurrences:0});
 }
 for(const g of gaps)rows.push({
  year:g.year,committeeName:g.committeeName,hearingDate:g.hearingDate,
  writtenMinuteClass:g.originalClerkSha256?'authenticated_clerk_html':
   g.independentOrphanOfficialLrlPdfSource?'authenticated_other_lrl_pdf':
   'unverified_written_minutes',
  originalOriginalIdFromImmutable141Ledger:true,
  officialOriginalSha:g.originalClerkSha256||
   g.independentOrphanOfficialLrlPdfSource?.originalPdfSha256||null,
  namedRollCandidates:g.originalClerkSha256?0:null,
  namedChoiceOccurrences:g.originalClerkSha256?0:null
 });
 return {
  officialIndexedMeetings:1592,authenticatedWrittenMinutesMeetingDates:1563,
  indexedMeetingDatesStillWithoutWrittenMinutes:29,
  byYear:[2022,2023,2024,2025].map((year,i)=>({
   year,archiveMinutesWithoutIndexLink:i===0?1:0,
   missingOriginalWrittenMinutes:[4,6,14,5][i]
  })),
  perIndexedMeeting:rows
 } as unknown as Original;
}
test('independently SHA-authenticated eight original PDFs recover four new indexed days, with no duplicate morning/evening meeting identities',()=>{
 const output=integrateSenate864SupplementaryLrlOriginalMinutes(original(),receipt);
 assert.equal(output.authenticatedWrittenMinutesMeetingDates,1567);
 assert.equal(output.indexedMeetingDatesStillWithoutWrittenMinutes,25);
 assert.equal(output.priorAuthenticatedWrittenMinutesMeetingDates,1563);
 assert.equal(output.priorIndexedMeetingDatesStillWithoutWrittenMinutes,29);
 assert.equal(output.newlyOriginalShaAuthenticatedGovernmentMinutesBodies,8);
 assert.equal(output.newlyOriginalShaAuthenticatedGovernmentMeetingDates,4);
 assert.equal(output.originalArchivedPdfBodiesOutsideOriginalIndex,9);
 assert.deepEqual(output.byYear.map(x=>x.missingOriginalWrittenMinutes),[3,3,14,5]);
 assert.equal(output.perIndexedMeeting.length,1592);
 const add=output.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='authenticated_other_lrl_pdf'
  &&'additionalOriginalPdfBodies' in x);
 assert.equal(add.length,4);
 assert.ok(add.every(x=>Array.isArray(x.additionalOriginalPdfBodies)&&
  x.additionalOriginalPdfBodies.length===2));
 assert.deepEqual(add.map(x=>x.hearingDate).sort(),[
  '2022-04-04','2023-02-16','2023-03-15','2023-03-20']);
 assert.equal(output.perIndexedMeeting.filter(x=>x.writtenMinuteClass==='unverified_written_minutes').length,25);
 assert.equal(output.sourceToActualVoteEventOrMemberVoteStoreStillNotReconciled,true);
 assert.equal(output.allOriginalSenateCommitteeActionsKnown,false);
 assert.equal(JSON.stringify(output).includes('2021-'),false);
});
test('only official SHA-verified original Minutes with correct day, URL and tally can supplement an originally held day',()=>{
 const base=original();
 const tamper=(fn:(r:SupplementaryMinutes)=>void)=>{
  const m=structuredClone(receipt);fn(m);
  assert.throws(()=>integrateSenate864SupplementaryLrlOriginalMinutes(base,m));
 };
 tamper(r=>r.originalFourMeetingDates[0]!.officialOriginalPdfBodies[0]!.originalRawPdfSha256='INVALID');
 tamper(r=>r.originalFourMeetingDates[0]!.officialOriginalPdfBodies[0]!.individualNamedChoicesInferred=10);
 tamper(r=>r.originalFourMeetingDates[0]!.officialOriginalPdfBodies[0]!.parserNamedRollCandidates=1);
 tamper(r=>r.originalFourMeetingDates[0]!.officialOriginalPdfBodies[0]!.originalSourceUrl='https://attacker.example.org/minutes.pdf');
 tamper(r=>r.originalFourMeetingDates[0]!.hearingDate='2021-04-04');
 tamper(r=>r.originalAcquisitionRunId=0);
 tamper(r=>r.originalActionsArtifactZipSha256='0'.repeat(64));
 const changed=original();
 const target=changed.perIndexedMeeting.find(x=>x.hearingDate==='2022-04-04'&&
  x.committeeName==='Education Finance and Policy');
 assert.ok(target);
 target.writtenMinuteClass='authenticated_clerk_html';
 assert.throws(()=>integrateSenate864SupplementaryLrlOriginalMinutes(changed,receipt));
});
test('original source receipt contains exactly eight original bytes/sha pairs and 14 NON-DEDUPLICATED contextual parser observations, not named senator choices',()=>{
 assert.equal(receipt.originalFourMeetingDates.length,4);
 const bodies=receipt.originalFourMeetingDates.flatMap(x=>x.officialOriginalPdfBodies);
 assert.equal(bodies.length,8);
 assert.equal(new Set(bodies.map(x=>x.originalRawPdfSha256)).size,8);
 assert.equal(bodies.reduce((n,x)=>n+x.parserContextActionOccurrences,0),14);
 assert.ok(bodies.every(x=>x.parserNamedRollCandidates===0&&
  x.individualNamedChoicesInferred===0&&x.sourceToStoredPersonVoteParityPerformed===false));
 assert.ok(bodies.every(x=>x.originalPdfByteShaIndependentlyVerified));
 assert.equal(receipt.exclude2021CommitteeResearch,true);
 assert.equal(receipt.revisedWithoutOriginalWrittenMinutes,25);
});
