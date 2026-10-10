import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const bytes=readFileSync(new URL(
 '../docs/evaluation/source-proof/senate-2025-elections-fifteen-historical-roster-source-ledger.json',
 import.meta.url));
const blobSha=createHash('sha1').update('blob '+bytes.byteLength+'\0').update(bytes).digest('hex');
const p=JSON.parse(bytes.toString('utf8'));

test('2025 Elections prior original-source and actual one-time roster proof archives are immutably pinned',()=>{
 assert.equal(blobSha,'1454d0f66e7fe59d8da0b2739b14b05efcd7a47a');
 assert.equal(p.issue,864);
 assert.equal(p.originalSourceReviewRun,38079646647);
 assert.equal(p.actualRosterSourceCheckRun,38086019735);
 assert.equal(p.originalShaVerifiedSupplementalArtifactId,11679214346);
 assert.equal(p.actualRosterArtifactId,11682172667);
 assert.equal(p.sourceReviewPR,933);
 for(const key of ['originalSourceJsonSha256','actualRosterArtifactZipSha256','actualRosterArtifactJsonSha256'])
  assert.match(p[key],/^[a-f0-9]{64}$/);
 assert.equal(p.knownPostFebruary3HistoricalRosterMembers,11);
 assert.equal(p.candidateProvisionalRollBlocks,15);
 assert.equal(p.sourceExplicitNamedMemberChoiceTokens,163);
 assert.equal(p.blocksNamingAllElevenHistoricalSenators,14);
 assert.equal(p.blocksNamingNineOfEleven,1);
 assert.equal(p.blocksStillOnSourceDateOrAttendanceHold,2);
 assert.equal(p.noUnknownMemberFingerprints,true);
 assert.equal(p.billWeberExitedByFebruary3AndIsNotExpectedOnTheseDates,true);
});

test('source-offset queue has fifteen unique provisional blocks in six 2025 Elections original PDF URLs',()=>{
 const rows=p.originalSourceRecords;
 assert.equal(rows.length,15);
 assert.equal(new Set(rows.map((x:{originalOfficialPdfUrl:string})=>x.originalOfficialPdfUrl)).size,6);
 assert.equal(new Set(rows.map((x:{originalOfficialPdfUrl:string;originalSourceTextOffset:number})=>
   x.originalOfficialPdfUrl+'|'+x.originalSourceTextOffset)).size,15);
 assert.equal(rows.reduce((n:number,x:{matchedPublishedHistoricalCommitteeRosterFingerprints:number})=>
   n+x.matchedPublishedHistoricalCommitteeRosterFingerprints,0),163);
 assert.equal(rows.filter((x:{officialRosterMembersWithoutOriginalNamedChoice:number})=>
   x.officialRosterMembersWithoutOriginalNamedChoice===0).length,14);
 assert.equal(rows.filter((x:{officialRosterMembersWithoutOriginalNamedChoice:number})=>
   x.officialRosterMembersWithoutOriginalNamedChoice===2).length,1);
 for(const r of rows){
  assert.equal(r.year,2025);
  assert.ok(r.hearingDate>'2025-02-03');
  assert.equal(r.committeeName,'Elections');
  assert.equal(new URL(r.originalOfficialPdfUrl).hostname,'www.lrl.mn.gov');
  assert.ok(new URL(r.originalOfficialPdfUrl).pathname.startsWith('/archive/minutes/senate/2025/elections/'));
  assert.equal(r.originalReportedNamedYea+r.originalReportedNamedNay,r.matchedPublishedHistoricalCommitteeRosterFingerprints);
  assert.equal(r.originalReportedNamedYea+r.originalReportedNamedNay+r.officialRosterMembersWithoutOriginalNamedChoice,11);
  assert.equal(r.automaticProductionHistoricalMemberVotePromotion,false);
 }
});

test('misdated February 13 and March 27 source motions remain HOLD despite member roster hash match',()=>{
 const rows=p.originalSourceRecords;
 const held=rows.filter((x:{sourceDateOrAttendanceReviewState:string})=>
   x.sourceDateOrAttendanceReviewState.startsWith('HOLD'));
 assert.deepEqual(held.map((x:{hearingDate:string})=>x.hearingDate),['2025-02-13','2025-03-27']);
 assert.equal(held[0].matchedPublishedHistoricalCommitteeRosterFingerprints,11);
 assert.equal(held[1].matchedPublishedHistoricalCommitteeRosterFingerprints,9);
 assert.equal(p.limits.feb13OfficialSourceMarksThreeRecordedVotersAlsoAbsent,true);
 assert.equal(p.limits.mar27TwoMembersNoRecordedChoiceNotInferredAbsentOrNay,true);
 assert.equal(p.sourceRosterMembersWithoutChoiceNotImputed,true);
 assert.equal(p.limits.historicalAttendanceAndExactMotionsNotFullyCertified,true);
 assert.equal(p.limits.sourceToPrivatePersistedRowsNotReconciled,true);
 assert.equal(p.limits.productionDatabaseUntouched,true);
 assert.equal(p.limits.modelsForecastsServingSchedulers2027Untouched,true);
 assert.equal(p.limits.keepHistoricalIssue864Open,true);
});