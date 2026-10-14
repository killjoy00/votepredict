import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const RECEIPT='docs/evaluation/source-proof/senate-864-2023-fifty-government-clerk-source-receipts.json';
const OLD='docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('43 independent original Senate Clerk HTML sources reconcile 50 specific held 2023 official meeting identities',()=>{
 const r=read(RECEIPT),old=read(OLD);
 assert.equal(r.schemaVersion,'senate-864-original-2023-fifty-lrl-indexed-alternate-clerk-sources-v1');
 assert.deepEqual(r.activeScopeYears,[2022,2023,2024,2025]);
 assert.equal(r.excludes2021HistoricalResearch,true);
 assert.equal(r.sourceProof.runId,38507388355);
 assert.equal(r.sourceProof.originalArtifactId,11868162776);
 assert.equal(r.sourceProof.originalArtifactZipSha256,
  '4ab6e5cf20cc363d6dc33bd82d5d6ff2f0d5187e2b390c712cb7dc43aedd3d89');
 assert.equal(r.originalLRLIndexCensusSha256,old.officialLrlOriginalIndexedCensus.originalJsonSha256);
 assert.equal(r.originalMeetingSourceReceipts.length,50);
 const keys=new Set(old.perOfficiallyIndexedMeeting.filter((x:any)=>
  x.onlineSenateClerkMinutesSourceStatus==='not_yet_authenticated_by_this_alternate_source_route')
  .map((x:any)=>x.hearingDate+'|'+x.committeeName));
 const seen=new Set<string>();
 let recovered=0,count=0;
 for(const x of r.originalMeetingSourceReceipts){
  const k=x.hearingDate+'|'+x.committeeName;
  assert.equal(keys.has(k),true);
  assert.equal(seen.has(k),false);
  seen.add(k);
  if(x.status==='authenticated_official_senate_clerk_minutes'){
   recovered++;
   assert.match(x.clerkHtmlSha256,/^[a-f0-9]{64}$/);
   assert.match(x.clerkTextSha256,/^[a-f0-9]{64}$/);
   assert.ok(Number.isSafeInteger(x.hearingId)&&x.hearingId>=17000);
   assert.ok(Number.isSafeInteger(x.candidateMotions)&&x.candidateMotions>=0);
   count+=x.candidateMotions;
  }else{
   assert.match(x.status,/_HOLD$/);
   assert.equal(x.clerkHtmlSha256,null);
   assert.equal(x.candidateMotions,null);
  }
 }
 assert.equal(seen.size,50);
 assert.equal(recovered,43);
 assert.equal(count,111);
 assert.equal(r.remaining2023IndexedMissingClerkOriginals,7);
 assert.equal(r.original2023NoLinkedLrlPdfMeetingDenominator,64);
 assert.equal(r.priorAuthenticated2023ClerkOriginals,14);
 assert.equal(r.originalNewResultOnlyCandidates,108);
 assert.equal(r.originalNewCountOnlyCandidates,3);
 assert.equal(r.originalNewExplicitNamedRollCandidates,0);
 assert.deepEqual(r.committeeResults.map((x:any)=>[
  x.committeeName,x.newlyAuthenticatedClerk,x.stillHeld]),[
  ['Taxes',26,2],['Agriculture, Broadband and Rural Development',16,1],
  ['Education Finance',1,2],['Environment, Climate, and Legacy',0,1],
  ['Jobs and Economic Development',0,1]
 ]);
});
test('no 2021 archival work, vote-side inference, persisted event parity or historical Clerk page publication claim',()=>{
 const r=read(RECEIPT);
 assert.equal(r.noProductionDbWritesOrReads,true);
 assert.equal(r.emptyParsedActionDoesNotProveNoRecordedVote,true);
 assert.equal(r.originalAllRecordedMotionsDenominatorKnown,false);
 assert.equal(r.originalAlternateClerkHistoricalFirstPublicByProven,false);
 assert.equal(r.originalSourceToPersistedRowMatchProven,false);
 assert.equal(r.other2022PrintParityUnproven,true);
 const s=JSON.stringify(r);
 assert.doesNotMatch(s,/namedMemberName|storedMemberVoteId|originalSideName|privateRowHash/);
});
