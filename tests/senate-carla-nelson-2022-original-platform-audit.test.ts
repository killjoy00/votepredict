import test from 'node:test';
import assert from 'node:assert/strict';
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts,
 verifyOnlyActualSenatorCarla2022SourceGate,
} from '../src/evidence/senate-carla-nelson-2022-original-platform-audit.js';

function officialCarla():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:316000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Carla J. Nelson',officialNameRaw:'Nelson, Carla J.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:null,district:'24'}]},
  ],
 };
}
test('Carla qualifies because independent official LRL proves ACTUAL Minnesota Senate service',()=>{
 const s=verifyOnlyActualSenatorCarla2022SourceGate(officialCarla());
 assert.equal(s.status,'verified_senate_service');
 assert.equal(s.officialName,'Carla J. Nelson');
 assert.equal(s.serviceForThisElectionFollowingYearVerified,true);
 assert.equal(s.term?.includes('SD24'),true);
});
test('no synthetic original page can be counted as a real historically verified original archived issue proof',()=>{
 const a=officialCarla();
 const r=auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(a);
 assert.equal(r.totals.confirmedPersonsWhoActuallyServedInSenate,1);
 assert.equal(r.totals.originalHistoricalArchivePagesExpected,2);
 assert.equal(r.totals.originalHistoricalArchivePagesRechecked,0);
 assert.equal(r.totals.candidateAuthoredCampaignIssuePolicyAreas,6);
 assert.equal(r.totals.quoteOccurrenceChecksOnRawArchivedPages,0);
 assert.equal(r.totals.originalDateAttested2022CampaignExcerpts,0);
 assert.equal(r.totals.neverServedCandidatesInReport,0);
 assert.equal(r.source.firstWebsitePublicationDateUnknown,true);
 assert.equal(r.source.productionDatabaseMutations,0);
 assert.equal(r.source.modelForecastSourceAdmissions,0);
 assert.deepEqual(r.quotes.map(x=>x.issueFamily),[
  'taxes_revenue','public_safety','health','education',
  'environment_natural_resources','transportation',
 ]);
 assert.ok(r.quotes.every(x=>x.earliestAttestedExactStatementPublicByUtc
  ==='2022-10-06T16:15:31.000Z'));
 assert.ok(r.quotes.every(x=>x.independentlyReconfirmedExactStatementPublicByUtc
  ==='2022-10-06T16:48:45.000Z'));
 assert.ok(r.quotes.every(x=>x.todayAcquiredOriginalHtmlAtUtc==='2026-10-11T00:32:35.786Z'));
 assert.ok(r.quotes.every(x=>x.productionEvidenceItemId===null
  &&!x.eligibleForImmediateForecast
  &&!x.qualifiesForPastForecastOnlyAfterIndependentCutoffReview));
});
test('unproven official senate service blocks all original candidate quote rows',()=>{
 const missing=officialCarla();
 missing.senators=[];
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(missing),
  /Cannot attach original 2022 campaign policy/);
 const wrongHouseOnly=officialCarla();
 wrongHouseOnly.senators[0].senateServiceTerms=[
  {startsYear:2023,endsYear:null,district:'33'},
 ];
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(wrongHouseOnly),
  /Cannot attach original 2022 campaign policy/);
});
test('a partial, substituted, or mutated original 2022 HTML file cannot pass byte verification',()=>{
 const official=officialCarla();
 const fake=Buffer.from('<html><main>tax on social security benefits</main></html>');
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,{'carla-2022-page-a':fake}),/Both independently archived/);
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,{'carla-2022-page-a':fake,'carla-2022-page-b':fake}),
  /Original archived Senate campaign HTML file size mismatch/);
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,{'carla-2022-page-a':Buffer.alloc(160204,42),
    'carla-2022-page-b':Buffer.alloc(148019,42)}),
  /Original historical campaign HTML SHA-256 mismatch/);
 assert.throws(()=>auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,{'arbitrary-non-senator-page':fake} as never),
  /Unknown non-senator/);
});
test('all original exact issue excerpts require real 2022 captured bytes in a matching campaign-policy section',()=>{
 const r=auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(officialCarla());
 assert.equal(r.originalChecks[0].sourceCaptureAtUtc,'2022-10-06T16:15:31.000Z');
 assert.equal(r.originalChecks[1].sourceCaptureAtUtc,'2022-10-06T16:48:45.000Z');
 assert.ok(r.originalChecks.every(x=>x.firstAuthorPublicationDateKnown===false
  &&x.originalPageBytesIndependentlyReverifiedInThisRun===false));
 const ledgerText=JSON.stringify(r);
 assert.ok(!ledgerText.includes('Louis McNutt'));
 assert.ok(!ledgerText.includes('Dan Bohmer'));
 assert.ok(!ledgerText.includes('Kate Luthner'));
 assert.equal(r.quotes.length,6);
});
