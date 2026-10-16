import test from 'node:test';
import assert from 'node:assert/strict';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
import {buildOnlyActualSenatorsDatedIssueSourceLedger} from
 '../../src/evidence/senate-only-dated-campaign-issue-leads.js';

function verifiedDirectory():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir' as const;
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T22:00:00.000Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:330000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Ann M Johnson Stewart',officialNameRaw:'Johnson Stewart, Ann M',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2024,endsYear:2026,district:'45'}]},
   {officialName:'Keri Heintzeman',officialNameRaw:'Heintzeman, Keri',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2025,endsYear:2026,district:'6'}]},
   {officialName:'Michael Holmstrom',officialNameRaw:'Holmstrom, Michael',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2025,endsYear:2026,district:'29'}]},
   {officialName:'Robert Kupec',officialNameRaw:'Kupec, Robert - "Rob"',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'4'}]},
   {officialName:'Michael E. Kreun',officialNameRaw:'Kreun, Michael E.',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'32'}]},
  ],
 };
}
test('only FIVE historically served Minnesota Senators receive named campaign issue leads',()=>{
 const r=buildOnlyActualSenatorsDatedIssueSourceLedger(verifiedDirectory());
 assert.equal(r.totals.namedIndependentlyConfirmedPeopleWhoServedInSenate,5);
 assert.equal(r.totals.namedIssueSourceQuoteLeads,14);
 assert.equal(r.totals.actualArchivedHistoricalCampaignQuoteLeads,10);
 assert.equal(r.totals['2026OnlyPublisherStatementQuoteLeads'],4);
 assert.equal(r.totals.outOfScopeOrUnverifiedStatementRowsSuppressedWithoutNamingAnyone,7);
 assert.equal(r.totals.productionForecastEvidenceStatementsAdmitted,0);
 assert.deepEqual(r.senators.map(x=>x.name),[
  'Ann Johnson Stewart','Keri Heintzeman','Michael Holmstrom Jr',
  'Michael Kreun','Rob Kupec',
 ]);
 const output=JSON.stringify(r);
 for(const person of ['Louis McNutt','Dan Bohmer','Kate Luthner'])
  assert.equal(output.includes(person),false);
});
test('each original campaign quote has a true earlier archival capture date and current 2026 acquisition date separately',()=>{
 const r=buildOnlyActualSenatorsDatedIssueSourceLedger(verifiedDirectory());
 const archive=r.senators.flatMap(x=>x.sourceStatements).filter(x=>
  x.sourceClass==='candidate_owned_campaign_platform_original_historical_archive');
 assert.equal(archive.length,10);
 assert.ok(archive.every(x=>x.firstAttestedPublicByAtUtc===x.sourceOriginalCaptureAtUtc));
 assert.ok(archive.every(x=>x.originalHtmlSourceRetrievedOn==='2026-10-10'));
 assert.ok(archive.every(x=>x.conservativeResearchDate==='2024-09-04'
  ||x.conservativeResearchDate==='2025-04-24'
  ||x.conservativeResearchDate==='2025-08-26'));
 assert.ok(archive.every(x=>x.unknownAuthorFirstPublishedOn===null));
 assert.ok(archive.every(x=>x.originalSosFilingWebsiteFieldIndependentlyVerified===false
  &&x.eligibleForAutomaticForecast===false));
 const ann=archive.filter(x=>x.senatorName==='Ann Johnson Stewart');
 assert.ok(ann.every(x=>x.firstAttestedPublicByAtUtc==='2024-09-04T05:28:50.000Z'));
});
test('2022 candidate-submitted survey quotes dated ONLY by actual October 2026 retrieval, NOT by publisher headline date',()=>{
 const r=buildOnlyActualSenatorsDatedIssueSourceLedger(verifiedDirectory());
 const survey=r.senators.flatMap(x=>x.sourceStatements).filter(x=>
  x.sourceClass==='candidate_submitted_questionnaire_current_publisher_html_only');
 assert.equal(survey.length,4);
 assert.deepEqual([...new Set(survey.map(x=>x.senatorName))].sort(),['Michael Kreun','Rob Kupec']);
 assert.ok(survey.every(x=>x.conservativeResearchDate==='2026-10-10'));
 assert.ok(survey.every(x=>x.originalHtmlSourceRetrievedOn==='2026-10-10'));
 assert.ok(survey.every(x=>x.firstAttestedPublicByAtUtc===null));
 assert.ok(survey.every(x=>x.publisherDateIsIndependentlyConfirmed===false));
 assert.ok(survey.every(x=>x.publisherClaimedArticlePublicationOn==='2022-10-07'
  ||x.publisherClaimedArticlePublicationOn==='2022-10-19'));
 assert.ok(survey.every(x=>x.eligibleForAutomaticForecast===false));
});
test('namesake or never-seated candidate cannot be accepted as a senator',()=>{
 const wrong=verifiedDirectory();
 wrong.senators=wrong.senators.filter(s=>!s.officialName.includes('Kupec'));
 assert.throws(()=>buildOnlyActualSenatorsDatedIssueSourceLedger(wrong),
  /Senator-only source lead count changed/);
 const spoof=verifiedDirectory();
 spoof.source.sourceBytesSha256='does-not-match';
 assert.throws(()=>buildOnlyActualSenatorsDatedIssueSourceLedger(spoof),
  /Cannot output named senator sources/);
});
test('one actual former senator with a lost race may still qualify if LRL service is confirmed (no outcome-based exclusion)',()=>{
 const r=buildOnlyActualSenatorsDatedIssueSourceLedger(verifiedDirectory());
 assert.equal(r.sourceValidation.evenEarlierLosingCandidateEligibleOnlyIfActuallyServedAtSomePoint,true);
 assert.equal(r.sourceValidation.officialSenateServiceRequiredBeforePersonMayBeNamed,true);
 assert.equal(r.sourceValidation.retrievedDateIsMinimumActualDocumentObservationNotInferredPosting,true);
 assert.equal(r.sourceValidation.archivedHistoricCaptureTimeIsNoLaterThanDateForExactBytesNotAuthorFirstPostDate,true);
});
