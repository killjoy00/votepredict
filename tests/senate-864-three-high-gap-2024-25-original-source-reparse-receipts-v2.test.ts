import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const BASE='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json';
const V2='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts-v2.json';
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const key=(x:any)=>x.year+'|'+x.committeeName+'|'+x.hearingDate;
const value=(v:any,k:string)=>v[k]??0;

test('independently rerun original 53 Clerk source receipt proves 27 distinct named roll candidates across unchanged originals',()=>{
 const b=read(BASE),v=read(V2);
 assert.equal(v.schemaVersion,'senate-864-2024-25-53-original-clerk-named-roll-reparse-source-receipts-v2');
 assert.equal(v.originalSourceRunId,38501257729);
 assert.equal(v.originalSourceRunHeadSha,'1910d2880d70b0b80a9bc9f5d4813728794ab834');
 assert.equal(v.artifactId,11866375427);
 assert.equal(v.artifactZipSha256,'53fa9d0c13439030598151778ae38aa37aac892a09ee3d170da4a4f9d663b029');
 assert.equal(v.indexedNoMinutesPdfMeetings,53);
 assert.equal(v.everyOriginalMeeting.length,53);
 assert.equal(v.independentlyAuthenticatedOriginalSenateClerkBodies,38);
 assert.equal(v.heldNoOriginalClerkBodies,15);
 const old=new Map(b.everyOriginalMeeting.map((x:any)=>[key(x),x]));
 let oldNamed=0,newNamed=0,oldNames=0,newNames=0,resultOnly=0,countOnly=0,voice=0;
 for(const x of v.everyOriginalMeeting){
  const prior=old.get(key(x)) as any;
  assert.ok(prior,'One-to-one official government meeting index and v1 source receipt');
  assert.equal(x.senateClerkHtmlSha,prior.senateClerkHtmlSha,'Reparse did not replace actual original Clerk HTML bytes');
  assert.equal(x.senateClerkTextSha,prior.senateClerkTextSha,'Reparse did not change text normalization');
  assert.equal(x.status,prior.status,'Missing original HOLD never converted to no-meeting claim');
  assert.equal(x.originalHearingId,prior.originalHearingId);
  oldNamed+=value(prior,'originalExplicitNamedRolls');
  oldNames+=value(prior,'originalExplicitNamedChoiceEntries');
  newNamed+=value(x,'originalExplicitNamedRolls');
  newNames+=value(x,'originalExplicitNamedChoiceEntries');
  resultOnly+=value(x,'resultOnly');
  countOnly+=value(x,'countOnly');
  voice+=value(x,'voice');
 }
 assert.equal(old.size,53);
 assert.deepEqual([oldNamed,newNamed,oldNames,newNames],[15,27,191,343]);
 assert.deepEqual([resultOnly,countOnly,voice],[96,1,5]);
 assert.equal(v.originalSourceActionCandidates,129);
 assert.equal(96+1+5+27,129);
 assert.equal(v.historicalMemberIdJoinPerformed,false);
 assert.equal(v.committeeMemberVoteRowsImported,false);
 assert.equal(v.noProductionDatabaseTouched,true);
 assert.equal(v.originalFullMotionDenominatorKnown,false);
 assert.equal(v.originalWrittenFirstPublicByDateIndependentlyProven,false);
});

test('seven independently authenticated committee dates account for all +12 original named rolls and +152 source choice occurrences',()=>{
 const v=read(V2),b=read(BASE);
 const old=new Map(b.everyOriginalMeeting.map((x:any)=>[key(x),x]));
 const expected=[
  ['2024-03-12',3,39],['2024-03-14',2,26],
  ['2024-03-19',2,24],['2024-03-21',2,27],
  ['2024-03-26',1,13],['2024-04-09',1,11],['2024-04-16',1,12],
 ];
 assert.deepEqual(v.sourceChangeDeltas.map((x:any)=>[
  x.hearingDate,x.additionalNamedRolls,x.additionalChoiceOccurrences
 ]),expected);
 assert.ok(v.sourceChangeDeltas.every((x:any)=>x.year===2024&&
  x.committeeName==='State and Local Government and Veterans'));
 assert.equal(v.sourceChangeDeltas.reduce((n:number,x:any)=>n+x.additionalNamedRolls,0),12);
 assert.equal(v.sourceChangeDeltas.reduce((n:number,x:any)=>n+x.additionalChoiceOccurrences,0),152);
 for(const x of v.sourceChangeDeltas){
  const prior=old.get(key(x)) as any;
  assert.ok(prior);
  assert.equal(x.clerkOriginalHtmlSha256,prior.senateClerkHtmlSha);
  assert.equal(x.reparsedNamedRolls-x.firstPassNamedRolls,x.additionalNamedRolls);
  assert.equal(x.reparsedChoiceOccurrences-x.firstPassChoiceOccurrences,x.additionalChoiceOccurrences);
 }
 // All extracted source-count changes, including zero-change dates, are explicitly conserved.
 let changed=0;
 for(const x of v.everyOriginalMeeting){
  const prior=old.get(key(x)) as any;
  if(value(x,'originalExplicitNamedRolls')!==value(prior,'originalExplicitNamedRolls'))changed++;
 }
 assert.equal(changed,7);
 const raw=JSON.stringify(v);
 assert.doesNotMatch(raw,/namedMemberName|originalPrivatePersonId|storedEventId|persistedMemberVoteId/);
});
