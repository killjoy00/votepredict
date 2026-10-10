import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const bytes=readFileSync(new URL(
 '../docs/evaluation/source-proof/senate-2023-elections-ten-roster-matched-source-rolls-ledger.json',
 import.meta.url));
const sha=createHash('sha1').update('blob '+bytes.byteLength+'\0').update(bytes).digest('hex');
const p=JSON.parse(bytes.toString('utf8'));

test('official 2023 Elections public roster source proof ledger has exact immutable Git blob',()=>{
 assert.equal(sha,'5ef21dcefb1852420eaf81450af64aaacb4fdd61');
 assert.equal(p.issue,864);
 assert.equal(p.exactOriginalSourceRollRun,38084229868);
 assert.equal(p.original2023SourceArtifactId,11681598339);
 assert.equal(p.sourceOnlyRosterReviewRun,38085294202);
 assert.equal(p.sourceOnlyRosterReviewArtifactId,11682685643);
 for(const field of ['originalSourceJsonSha256','sourceOnlyRosterReviewZipSha256','sourceOnlyRosterReviewJsonSha256']){
  assert.match(p[field],/^[a-f0-9]{64}$/);
 }
 assert.equal(p.sourceOriginalPdfs,7);
 assert.equal(p.sourceProvisionalCandidateRolls,10);
 assert.equal(p.sourceStatusEntries,140);
 assert.equal(p.explicitNamedYeaNaySourceEntries,133);
 assert.equal(p.nonvotingPassOrAbsentSourceEntries,7);
 assert.equal(p.officialHistoricalCommitteeRosterSurnames,14);
 assert.equal(p.unknownSourceSurnameFingerprints,0);
 assert.equal(p.duplicateOrContradictorySourceNames,0);
});

test('all ten original source offsets have exactly fourteen public roster surnames; none are promoted',()=>{
 const rows=p.records;
 assert.equal(rows.length,10);
 assert.equal(new Set(rows.map((x:{hearingDate:string;sourceOffset:number})=>
   x.hearingDate+'|'+x.sourceOffset)).size,10);
 assert.deepEqual(rows.reduce((x:Record<string,number>,row:{hearingDate:string})=>{
  x[row.hearingDate]=(x[row.hearingDate]??0)+1;return x;
 },{}),{
  '2023-01-17':1,'2023-02-07':3,'2023-02-14':2,
  '2023-02-21':1,'2023-03-02':1,'2023-03-07':1,'2023-03-14':1,
 });
 const sum=(key:string)=>rows.reduce((n:number,r:Record<string,unknown>)=>n+Number(r[key]),0);
 assert.equal(sum('explicitOriginalNamedYeaNayChoiceCount'),133);
 assert.equal(sum('explicitAbsentOrPassCount'),7);
 assert.equal(sum('uniqueCommitteeRosterSurnameFingerprintCount'),140);
 for(const row of rows){
  assert.equal(row.noUnknownOrDuplicateCommitteeSurnames,true);
  assert.equal(row.explicitOriginalNamedYeaNayChoiceCount+row.explicitAbsentOrPassCount,14);
  assert.equal(row.eachOriginalCandidateStillProvisional,true);
  assert.equal(row.corroboratedSpecificFeb14AndersonAbsent,row.hearingDate==='2023-02-14');
  assert.ok(Number.isInteger(row.sourceOffset)&&row.sourceOffset>=0);
 }
});

test('official 2023 roster parity does not certify motion, daily attendance, or private historical DB equality',()=>{
 const limits=p.limitations;
 assert.equal(limits.originalMemberNamesAndFullTextNotCommitted,true);
 assert.equal(limits.senatorFullLegalIdentityBeyondSurnameUncertified,true);
 assert.equal(limits.dateSpecificAttendanceIndependentlyVerifiedForFeb7AndFeb14Only,true);
 assert.equal(limits.motionIdentityAndDistinctnessNotFullyProven,true);
 assert.equal(limits.senateCommitteeVotesNotFinalFloorPassage,true);
 assert.equal(limits.approvedHistoricalDatabaseReadOrJoinNotPerformed,true);
 assert.equal(limits.sourceProofNotAutomatedEvidenceImport,true);
 assert.equal(limits.noProductionDBOrForecastModelServingScheduler2027Writes,true);
 assert.equal(limits.keepIssue864Open,true);
 assert.deepEqual(p.independentPublishedHearingRosterReferences,[
  'https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17523&ls=93',
  'https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17600&ls=93',
 ]);
});