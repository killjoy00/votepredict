import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const INDEX='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
const LEDGER='docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const k=(x:any)=>[x.year,x.committeeName,x.hearingDate].join('|');
const sha=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
test('every 2022-25 no-PDF official committee/day exactly source-joins original 141 LRL census and retains source-level SHA or explicit hold',()=>{
 const r=read(LEDGER),index=read(INDEX);
 assert.equal(r.schemaVersion,'senate-864-2022-25-141-official-unlinked-meeting-to-authenticated-written-minutes-v3');
 assert.deepEqual(r.activeYears,[2022,2023,2024,2025]);
 assert.equal(r.exclude2021Completely,true);
 assert.equal(r.originalLrlIndexSourceSha256,index.originalIndexedCensus.originalJsonSha256);
 assert.equal(r.originalLrlIndexMeetings,1592);
 assert.equal(r.originalIndexLinkedMinuteMeetings,1451);
 assert.equal(r.originalIndexLinkedMinutePdfBodies,1452);
 assert.equal(r.originalNoLinkedMinuteMeetings,141);
 assert.equal(r.perOriginallyIndexedNoPdfMeeting.length,141);
 const expected=new Map<string,string>(index.meetingGroups.flatMap((group:any)=>
  group.missingMinutesMeetingDates.map((d:string)=>[
   [group.year,group.committeeName,group.year+'-'+d].join('|'),
   group.officialIndexCommitteeId
  ])));
 assert.equal(expected.size,141);
 const seen=new Set<string>();
 let covered=0;
 for(const row of r.perOriginallyIndexedNoPdfMeeting){
  const key=k(row);
  assert.equal(expected.get(key),row.committeeIndexId);
  assert.equal(seen.has(key),false);
  seen.add(key);
  assert.equal([2022,2023,2024,2025].includes(row.year),true);
  assert.equal(row.linkedLrlMinutesPdf,false);
  assert.equal(row.independentlyProvenOriginalPublicationDate,null);
  assert.equal(row.storedMemberVoteEventMatch,null);
  assert.equal(row.hearingDayConventionOnly,true);
  if(row.originalClerkSha256!==null){
   covered++;
   assert.equal(sha(row.originalClerkSha256)&&sha(row.originalClerkTextSha256),true);
   assert.ok(Number.isSafeInteger(row.originalSenateHearingId));
   assert.notEqual(row.sourceClass,'no_written_minutes_authenticated_through_independent_routes');
  }else{
   assert.equal(row.originalClerkTextSha256,null);
   assert.equal(row.nonExhaustiveParserMotionCandidates,null);
   assert.equal(row.originalSenateHearingId,null);
  }
 }
 assert.equal(seen.size,141);
 assert.equal(covered,111);
 assert.equal(r.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes,1563);
 assert.equal(r.stillWithoutAuthenticatedWrittenMinutes,29);
 assert.equal(r.independentlyAuthenticatedOtherUnlinkedOfficialLrlMinutesPdfMeetings,1);
});
test('independent 2022-25 per-year and per-committee-year alternate Clerk source conservation is not a stored-row completeness assertion',()=>{
 const r=read(LEDGER);
 assert.deepEqual(r.byYear.map((x:any)=>[
  x.year,x.indexedNoLinkedLrlMinutesPdf,x.independentlyAuthenticatedAlternativeClerkHtmlMeetings,
  x.remainingMeetingsWithoutAuthenticatedWrittenMinutes]),[
  [2022,12,7,4],[2023,64,58,6],[2024,42,28,14],[2025,23,18,5]
 ]);
 assert.equal(r.byCommitteeYearWithNoPdf.length,20);
 const sum=(k:string)=>r.byCommitteeYearWithNoPdf.reduce((n:number,x:any)=>n+x[k],0);
 assert.equal(sum('lrlIndexedNoLinkedPdfMeetings'),141);
 assert.equal(sum('authClerkWrittenMinuteMeetings'),111);
 assert.equal(sum('stillMissingAuthenticatedWrittenMinutes'),29);
 assert.ok(r.byCommitteeYearWithNoPdf.every((x:any)=>
  x.lrlIndexedNoLinkedPdfMeetings===x.totalAuthenticatedWrittenMinutesMeetings+
  x.stillMissingAuthenticatedWrittenMinutes));
 assert.equal(r.year2022PrintElectronicParityUnknown,true);
 assert.equal(r.noProductionDatabaseReadWrite,true);
 assert.equal(r.officialAllMotionsDenominator,null);
 assert.equal(r.sourceToCurrentProtectedStoredRowParity,null);
 assert.equal(r.unverifiedDoesNotImplyZeroRecordedVotes,true);
 const body=JSON.stringify(r);
 assert.doesNotMatch(body,/privateNamedMember|memberVotesRows|sourceNameChoiceDigest|originalMemberId/);
});

test('one exact unlinked 2022 Housing government PDF adds written-minute coverage but does not create roll-call votes or disposition',()=>{
 const r=read(LEDGER);
 const orig=read('docs/evaluation/source-proof/senate-864-2022-housing-unlinked-official-original-minutes-pdf-receipt.json');
 const rows=r.perOriginallyIndexedNoPdfMeeting.filter((x:any)=>x.independentOrphanOfficialLrlPdfSource!==undefined);
 assert.equal(rows.length,1);
 const x=rows[0];
 assert.deepEqual([x.year,x.committeeName,x.hearingDate],
  [2022,'Housing Finance and Policy','2022-03-24']);
 assert.equal(x.originalClerkSha256,null);
 assert.equal(x.linkedLrlMinutesPdf,false);
 assert.equal(x.sourceClass,'independent_original_lrl_archived_minutes_pdf_without_index_link');
 assert.equal(x.independentOrphanOfficialLrlPdfSource.originalPdfSha256,
  orig.source.originalPdfRawSha256);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.originalPdfTextSha256,
  orig.source.originalPdfTextSha256);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.governmentOfficialSourceUrl,
  orig.source.officialGovernmentUrl);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.originalShaVerifiedRun,38621595082);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.namedIndividualVoteEvidence,false);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.firstPublicByIndependentlyVerified,null);
 assert.equal(x.independentOrphanOfficialLrlPdfSource.parliamentaryMotionProposalsNotCertifiedOutcomes,2);
 assert.equal(orig.reportedDistinctParliamentaryVotesFromThisSource,0);
 assert.equal(orig.documentedFormalMotionProposals,2);
 assert.equal(orig.sourceRun.result,'success');
 assert.equal(r.newlyRetrievedAndShaPinnedOriginalGovernmentPdfBodiesOutsideIndex,1);
 assert.equal(r.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes,1563);
 assert.equal(r.stillWithoutAuthenticatedWrittenMinutes,29);
 assert.equal(r.sourceToCurrentProtectedStoredRowParity,null);
});

test('new independently SHA-proven 2023 Agriculture January 9 Clerk HTML is counted once and joins three-run proof',()=>{
 const r=read(LEDGER);
 const u=read('docs/evaluation/source-proof/senate-864-2023-fifty-original-clerk-three-run-union-receipts.json');
 const rows=r.perOriginallyIndexedNoPdfMeeting.filter((x:any)=>x.year===2023&&
  x.committeeName==='Agriculture, Broadband and Rural Development'&&x.hearingDate==='2023-01-09');
 assert.equal(rows.length,1);
 const x=rows[0];
 const proof=u.perExactGovernmentIndexedMeeting.find((y:any)=>y.hearingDate==='2023-01-09'&&
  y.committeeName===x.committeeName);
 assert.ok(proof);
 assert.equal(x.originalClerkSha256,proof.originalClerkHtmlSha256);
 assert.equal(x.originalClerkTextSha256,proof.originalClerkTextSha256);
 assert.equal(x.originalSenateHearingId,17288);
 assert.equal(x.sourceProofRunId,38622377355);
 assert.equal(x.nonExhaustiveParserMotionCandidates,0);
 assert.equal(x.explicitSourceNamedRollCandidates,0);
 assert.equal(x.storedMemberVoteEventMatch,null);
 assert.equal(r.separate2023ThreeRunUnionOriginalSourceProof.authenticatedOriginalDays2023,58);
 assert.equal(r.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes,1563);
 assert.equal(r.stillWithoutAuthenticatedWrittenMinutes,29);
});
