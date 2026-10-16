import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pageLeadsJson from '../../data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json' with { type: 'json' };
import sitesJson from '../../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with { type: 'json' };
import {
  planCampaignArchiveSourceRecovery,
  type CampaignPageLeadManifest, type OfflineCdxResult,
} from '../../src/evidence/campaign-archive-source-recovery.js';
import type { SenateSosSeedManifest } from '../../src/evidence/sos-senate-historical-candidate-inventory.js';

const leads=pageLeadsJson as unknown as CampaignPageLeadManifest;
const sites=sitesJson as unknown as SenateSosSeedManifest;
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const record=(timestamp:string,original:string,digest='digest-1',mimetype='text/html',code='200')=>
  [timestamp,original,mimetype,code,digest,'1200'];
function cdx(queryId:string,rows: string[][]):OfflineCdxResult {
  return {queryId,status:'complete',rows:[header,...rows],sourceResponseBytesAuthenticated:false};
}
const issueQuery=(candidate:string)=>planCampaignArchiveSourceRecovery(leads,sites).queries.find(q=>
  q.candidateName===candidate&&q.queryKind==='issue_exact')!;
const prefixQuery=(candidate:string)=>planCampaignArchiveSourceRecovery(leads,sites).queries.find(q=>
  q.candidateName===candidate&&q.queryKind==='site_prefix')!;

test('source-backed research snapshot has 6 campaign domains, 5 recovered hosts, 4 exact policy paths',()=>{
  const report=planCampaignArchiveSourceRecovery(leads,sites);
  assert.equal(report.totals.candidateDomains,6);
  assert.equal(report.totals.laterCrawlDomainsWithPagePaths,5);
  assert.equal(report.totals.exactPolicyPageUrlLeads,4);
  assert.equal(report.totals.archiveRequests,16);
  assert.equal(report.totals.providedOfflineCdxResponses,0);
  assert.equal(report.totals.independentlyVerifiedPreVoteIssueStatements,0);
  assert.equal(report.scope.historicalCampaignPageBytesVerified,0);
  assert.equal(report.scope.cdxAuthenticityIndependentlyVerified,false);
  assert.ok(report.candidates.every(c=>c.indexRowsStrictlyBeforeGeneral===0));
  assert.ok(report.candidates.every(c=>c.independentlyProvenPagePublicBy===null));
  assert.ok(report.candidates.every(c=>c.unqueried===c.requestedQueries));
});
test('exact policy URL targets are preserved with known elected or opponent attribution only as leads',()=>{
  const report=planCampaignArchiveSourceRecovery(leads,sites);
  assert.deepEqual(
    report.queries.filter(q=>q.queryKind==='issue_exact').map(q=>q.originalUrl).sort(),
    [
      'https://amandaformn.com/issues/',
      'https://annjohnsonstewart.com/priorities/',
      'https://louismcnuttformnsenate.com/issues',
      'https://www.mike4mnsenate.com/platform',
    ].sort());
  assert.ok(report.queries.some(q=>q.candidateName==='Dwight Dorau'&&q.queryKind==='site_prefix'));
  assert.equal(report.candidates.find(c=>c.candidateName==='Dwight Dorau')?.sourceLaterResearchPagePaths,0);
  assert.ok(report.queries.every(q=>q.originalPageBytesAlreadyAuthenticated===false));
});
test('election-day and later archive queries are NEVER included in pre-election URL requests',()=>{
  const report=planCampaignArchiveSourceRecovery(leads,sites);
  const find=(name:string)=>report.queries.find(q=>q.candidateName===name)!;
  assert.equal(find('Ann Johnson Stewart').requestedTo,'20241104');
  assert.equal(find('Keri Heintzeman').requestedTo,'20250428');
  assert.equal(find('Amanda Hemmingsen-Jaeger').requestedTo,'20251103');
  assert.equal(find('Michael Holmstrom Jr').requestedTo,'20251103');
  assert.ok(report.queries.every(q=>q.requestedFrom==='20240101'));
  assert.ok(report.queries.every(q=>!q.cdxApiUrl.includes('collapse')));
  assert.ok(report.queries.filter(q=>q.queryKind==='site_prefix').every(q=>q.cdxApiUrl.includes('matchType=prefix')));
  assert.ok(report.queries.every(q=>q.cdxApiUrl.includes('output=json')&&q.cdxApiUrl.includes('limit=400')));
});
test('2026 source commit/metadata text is not allowed to become 2024/2025 archive proof',()=>{
  const report=planCampaignArchiveSourceRecovery(leads,sites);
  assert.equal(report.laterCrawlCommitDate,'2026-10-10T17:33:17Z');
  assert.ok(leads.candidates.flatMap(c=>c.pages).every(p=>
    p.pageTextExtractedIn2026Only&&!p.historicalSitePageBytesProven
    &&p.historicalSnapshotCapturedAt===null));
  assert.ok(leads.candidates.some(c=>c.pages.some(p=>p.sourceMetadataMentionsYears.includes('2026'))));
  const mutant=structuredClone(leads);
  mutant.laterResearchSnapshot.githubCommitCommitterDate='2025-10-01T00:00:00Z';
  assert.throws(()=>planCampaignArchiveSourceRecovery(mutant,sites),/later third-party crawl/);
  const mutant2=structuredClone(leads);
  (mutant2.candidates[0].pages[0] as unknown as {historicalSnapshotCapturedAt:string}).historicalSnapshotCapturedAt='2024-06-01T00:00:00Z';
  assert.throws(()=>planCampaignArchiveSourceRecovery(mutant2,sites),/issue-page path/);
});
test('manifest cannot attach campaign website to a different person or neighboring district',()=>{
  const x=structuredClone(leads);
  x.candidates[0].candidateName='A Completely Different Person';
  assert.throws(()=>planCampaignArchiveSourceRecovery(x,sites),/No unique prior candidate/);
  const y=structuredClone(leads);
  y.candidates[0].district='44';
  assert.throws(()=>planCampaignArchiveSourceRecovery(y,sites),/No unique prior candidate/);
});
test('source page cannot silently jump to unrelated website or fake Git blob SHA',()=>{
  const x=structuredClone(leads);
  x.candidates.find(c=>c.candidateName==='Ann Johnson Stewart')!.pages[1].originalUrl='https://other-person.example/positions';
  assert.throws(()=>planCampaignArchiveSourceRecovery(x,sites),/Unverified\/invalid issue-page/);
  const y=structuredClone(leads);
  y.candidates.find(c=>c.candidateName==='Ann Johnson Stewart')!.pages[1].sourceTextGitBlobSha='bad';
  assert.throws(()=>planCampaignArchiveSourceRecovery(y,sites),/Unverified\/invalid issue-page/);
});
test('provided CDX metadata may reveal earlier indexed policy URLs, but can NEVER validate extracted text',()=>{
  const query=issueQuery('Amanda Hemmingsen-Jaeger');
  const rows=[
    record('20250902113659','https://amandaformn.com/issues/','digest-1'),
    record('20251012103659','http://www.amandaformn.com/issues/','digest-2'),
    record('20251104103659','https://amandaformn.com/issues/','digest-3'), // same-day excluded
    record('20261101000000','https://amandaformn.com/issues/','digest-4'), // later year excluded
  ];
  const report=planCampaignArchiveSourceRecovery(leads,sites,[cdx(query.id,rows)]);
  const amanda=report.candidates.find(c=>c.candidateName==='Amanda Hemmingsen-Jaeger')!;
  assert.equal(amanda.indexRowsStrictlyBeforeGeneral,2);
  assert.equal(amanda.indexedPolicyUrlCandidatesStrictlyBeforeGeneral,2);
  assert.equal(amanda.indexRowsStrictlyBeforePrimary,0);
  assert.equal(amanda.earliestIndexClaimedPolicyCapture,'2025-09-02T11:36:59.000Z');
  assert.equal(amanda.versionsSelectedForFutureByteReview.length,2);
  assert.equal(amanda.independentlyProvenPagePublicBy,null);
  assert.equal(amanda.campaignIssueStatementsVerified,0);
  assert.ok(amanda.versionsSelectedForFutureByteReview.every(r=>!r.originalArchiveResponseBytesVerified&&!r.historicalForecastEligible));
  assert.equal(report.totals.independentlyVerifiedPreVoteIssueStatements,0);
});
test('strictly pre-primary and pre-general index-capture counts are separate',()=>{
  const query=prefixQuery('Keri Heintzeman');
  const report=planCampaignArchiveSourceRecovery(leads,sites,[cdx(query.id,[
    record('20250305101010','https://heintzemanforsenate.com/','AA'),
    record('20250420101010','https://heintzemanforsenate.com/','BB'),
    record('20250429101010','https://heintzemanforsenate.com/','CC'),
  ])]);
  const keri=report.candidates.find(c=>c.candidateName==='Keri Heintzeman')!;
  assert.equal(keri.indexRowsStrictlyBeforePrimary,1);
  assert.equal(keri.indexRowsStrictlyBeforeGeneral,2);
  assert.equal(keri.independentlyProvenPagePublicBy,null);
});
test('malformed CDX source cannot be counted as no captures',()=>{
  const query=prefixQuery('Keri Heintzeman');
  assert.throws(()=>planCampaignArchiveSourceRecovery(leads,sites,[cdx(query.id,[
    record('20250230030303','https://heintzemanforsenate.com/'),
  ])]),/Impossible/);
});
test('cross-domain CDX capture is rejected rather than attached to a candidate',()=>{
  const query=prefixQuery('Keri Heintzeman');
  assert.throws(()=>planCampaignArchiveSourceRecovery(leads,sites,[cdx(query.id,[
    record('20250305101010','https://anothercandidate.com/issues'),
  ])]),/Cross-candidate/);
  const exact=issueQuery('Amanda Hemmingsen-Jaeger');
  assert.throws(()=>planCampaignArchiveSourceRecovery(leads,sites,[cdx(exact.id,[
    record('20251001000000','https://amandaformn.com/private-not-on-this-issue-path/'),
  ])]),/not in exact-source request/);
});
test('duplicate or unknown input CDX query ID is rejected',()=>{
  const query=prefixQuery('Keri Heintzeman');
  const data=cdx(query.id,[record('20250305101010','https://heintzemanforsenate.com/')]);
  assert.throws(()=>planCampaignArchiveSourceRecovery(leads,sites,[data,data]),/Unknown\/duplicate/);
  assert.throws(()=>planCampaignArchiveSourceRecovery(leads,sites,[{...data,queryId:'not-a-query'}]),/Unknown\/duplicate/);
});
test('failed query is visible and unknown is distinct from verified absence',()=>{
  const query=prefixQuery('Keri Heintzeman');
  const report=planCampaignArchiveSourceRecovery(leads,sites,[
    {queryId:query.id,status:'failed',rows:null,sourceResponseBytesAuthenticated:false},
  ]);
  const keri=report.candidates.find(c=>c.candidateName==='Keri Heintzeman')!;
  assert.equal(keri.queriedFailed,1);
  assert.equal(keri.queriedCompleted,0);
  assert.equal(keri.unqueried,1);
  assert.equal(keri.campaignIssueStatementsVerified,0);
});
test('upstream 400-CDX-row cap stays explicit as a truncation warning',()=>{
  const query=prefixQuery('Keri Heintzeman');
  const rows=Array.from({length:400},(_,i)=>record(
    new Date(Date.UTC(2025,2,5,0,0,0)+i*1000).toISOString().replace(/[-:TZ.]/g,'').slice(0,14),
    'https://heintzemanforsenate.com/',String(i)));
  const report=planCampaignArchiveSourceRecovery(leads,sites,[cdx(query.id,rows)]);
  const keri=report.candidates.find(c=>c.candidateName==='Keri Heintzeman')!;
  assert.equal(keri.anyDiscoveryTruncated,true);
  assert.equal(keri.completenessCertified,false);
});
test('offline CLI exports concrete retrieval queries and no fictitious historical statement',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate-archive-plan-'));
  try{
    const out=join(dir,'queries.json');
    execFileSync('node',['--import','tsx','scripts/plan-senate-campaign-archive-source-recovery-offline.ts',
      '--output',out],{timeout:20_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(report.totals.archiveRequests,16);
    assert.equal(report.totals.exactPolicyPageUrlLeads,4);
    assert.equal(report.totals.independentlyVerifiedPreVoteIssueStatements,0);
    assert.equal(report.scope.doesNotFetchArchives,true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline CLI accepts bounded imported CDX index and refuses to overwrite results',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate-archive-import-'));
  try{
    const query=prefixQuery('Keri Heintzeman');
    const src=join(dir,'import.json'),out=join(dir,'out.json');
    writeFileSync(src,JSON.stringify({schema:'campaign-archive-offline-cdx-index-v1',
      results:[cdx(query.id,[record('20250305101010','https://heintzemanforsenate.com/')])]}));
    const args=['--import','tsx','scripts/plan-senate-campaign-archive-source-recovery-offline.ts',
      '--cdx-export',src,'--output',out];
    execFileSync('node',args,{timeout:20_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(report.totals.providedOfflineCdxResponses,1);
    assert.equal(report.totals.candidatesWithAnyIndexCapture,1);
    assert.equal(report.totals.independentlyVerifiedPreVoteIssueStatements,0);
    assert.throws(()=>execFileSync('node',args,{timeout:20_000,stdio:'pipe'}));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
