import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const PATH='docs/evaluation/source-proof/senate-864-2023-fifty-original-clerk-three-run-union-receipts.json';
const FIRST='docs/evaluation/source-proof/senate-864-2023-fifty-government-clerk-source-receipts.json';
const INDEX='docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const id=(r:any)=>r.hearingDate+'|'+r.committeeName;

test('three independently successful original government source runs authenticate the 44-of-50 union with no lost source SHA',()=>{
 const u=read(PATH),f=read(FIRST),index=read(INDEX);
 assert.equal(u.schemaVersion,'senate-864-2023-fifty-official-clerk-three-run-original-sha-union-v1');
 assert.deepEqual(u.activeHistoricalScope,[2022,2023,2024,2025]);
 assert.equal(u.exclude2021CommitteeResearch,true);
 assert.equal(u.originalLrl141MeetingCensusSha256,index.officialLrlOriginalIndexedCensus.originalJsonSha256);
 assert.equal(u.original2023NoLrlLinkedPdfMeetingDays,64);
 assert.equal(u.alreadyAuthenticatedOriginal2023ClerkSourceDaysBeforeTheseRuns,14);
 assert.equal(u.independentlyIndexedStillToProbeInitially,50);
 assert.equal(u.additionalDistinctOriginalSenateClerkBodiesRecoveredInThreeRuns,44);
 assert.equal(u.stillWithoutOriginalAuthenticatedClerkInFifty,6);
 assert.equal(u.cumulativeAlternativeClerkOriginals2023,58);
 assert.equal(u.nonExhaustiveOriginalActionCandidates,111);
 assert.equal(u.sourceRunArtifactProvenance.length,3);
 assert.deepEqual(u.sourceRunArtifactProvenance.map((x:any)=>[
  x.runId,x.artifactId,x.artifactZipSha256,x.originalBodiesAuthenticated,x.success]),[
  [38507113452,11868097943,'859d02a76c83d83b3d98c0c5728a0c62519d79f3d97f286c6fbe6d6aa7ba4084',41,true],
  [38507388355,11868162776,'4ab6e5cf20cc363d6dc33bd82d5d6ff2f0d5187e2b390c712cb7dc43aedd3d89',43,true],
  [38622377355,11922573355,'7d36f8813d8dd2a4932c6c1d875a96551a7b7bb067ccfd5bee0e774e3000d329',43,true]
 ]);
 assert.equal(u.unchangedHtmlShaAtAllOverlappingAuthenticatedSourceDays,true);
 assert.equal(u.perExactGovernmentIndexedMeeting.length,50);
 const previous=new Map(f.originalMeetingSourceReceipts.map((x:any)=>[id(x),x]));
 const unresolved=index.perOfficiallyIndexedMeeting.filter((x:any)=>
  x.onlineSenateClerkMinutesSourceStatus==='not_yet_authenticated_by_this_alternate_source_route');
 const keys=new Set(unresolved.map(id));
 let authentic=0,held=0;
 const seen=new Set<string>();
 for(const m of u.perExactGovernmentIndexedMeeting){
  const k=id(m);
  assert.equal(keys.has(k),true,'Must be originally indexed no-LRL-minutes meeting');
  assert.equal(seen.has(k),false);seen.add(k);
  const older=previous.get(k) as any;
  assert.ok(older,'Frozen first-pass official-source meeting receipt');
  if(m.clerkOriginalFoundInAtLeastOneOfficialSourceRun){
   authentic++;
   assert.match(m.originalClerkHtmlSha256,/^[a-f0-9]{64}$/);
   assert.match(m.originalClerkTextSha256,/^[a-f0-9]{64}$/);
   assert.ok(Number.isSafeInteger(m.originalSenateHearingId));
   assert.ok(m.verifiedSourceRunIds.length>=1);
   assert.ok(Number.isSafeInteger(m.currentSourceActionCandidatesNonExhaustive));
   if(older.status==='authenticated_official_senate_clerk_minutes'){
    assert.equal(m.originalClerkHtmlSha256,older.clerkHtmlSha256,
     'No earlier 43 original-SHA proof can disappear or be substituted');
    assert.equal(m.originalClerkTextSha256,older.clerkTextSha256);
   }
  }else{
   held++;
   assert.equal(m.originalClerkHtmlSha256,null);
   assert.equal(m.currentSourceActionCandidatesNonExhaustive,null);
   assert.equal(m.verifiedSourceRunIds.length,0);
  }
  assert.equal(m.exactOriginalFirstPublicByDate,null);
  assert.equal(m.sourceNotReceivedIsNotProofOfNoVotes,true);
  assert.equal(m.sourceIndividualNamedVoteRowsImported,0);
 }
 assert.equal(seen.size,50);assert.deepEqual([authentic,held],[44,6]);
 assert.deepEqual(u.byCommittee.map((x:any)=>[
  x.committeeName,x.shaVerifiedWrittenClerkOriginals,x.sourceHolds]),[
  ['Taxes',26,2],['Agriculture, Broadband and Rural Development',17,0],
  ['Education Finance',1,2],['Environment, Climate, and Legacy',0,1],
  ['Jobs and Economic Development',0,1]
 ]);
});
test('original January 9 Agriculture Clerk source gains minute coverage without invented choice or result',()=>{
 const u=read(PATH),r=u.perExactGovernmentIndexedMeeting.find((x:any)=>
  x.hearingDate==='2023-01-09'&&x.committeeName==='Agriculture, Broadband and Rural Development');
 assert.ok(r);
 assert.equal(r.clerkOriginalFoundInAtLeastOneOfficialSourceRun,true);
 assert.deepEqual(r.verifiedSourceRunIds,[38622377355]);
 assert.equal(r.originalSenateHearingId,17288);
 assert.equal(r.originalClerkHtmlSha256,'22223d3e82e24cc1ce6fc4bda901d04f29c14af9684efb66a0f419388e66ccad');
 assert.equal(r.currentSourceActionCandidatesNonExhaustive,0);
 assert.equal(r.originalPrintedNamedRollCandidatesNonExhaustive,0);
 const apr=u.perExactGovernmentIndexedMeeting.find((x:any)=>
  x.hearingDate==='2023-04-26'&&x.committeeName==='Taxes');
 assert.ok(apr);
 assert.ok(apr.verifiedSourceRunIds.includes(38507388355));
 assert.equal(apr.originalClerkHtmlSha256,'bc58743a48aa3750e6dcfd3e42e599091c592e58106e896f69e25b44c3661f56');
 assert.notEqual(apr.latestAttemptStatus,'authenticated_official_senate_clerk_minutes');
 assert.equal(u.originalIndividualNamedYeaNayMemberVotesVerifiedHere,0);
 assert.equal(u.noProdReadWrite,true);
 assert.equal(u.sourceToCurrentProtectedStoredRowMatchPerformed,false);
 assert.equal(u.originalExactFirstPublicByDateKnown,false);
 assert.doesNotMatch(JSON.stringify(u),/originalMemberChoiceName|privateStoredVoteId|sourceYeaNameArray/);
});
