/** Actual public GitHub Actions metadata RECEIPTS, not original politician statements. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PINNED_PUBLIC_ORIGINAL_PAGES} from
  '../src/evidence/senate-media-pinned-public-passage-audit.js';

interface Receipt {
  leadId:string;archivedCaptureUtc:string;
  observedOriginalHtmlSha256:string;
  observedRawBodyBytes:number;indexedPayloadSha1Base32:string;
}
const report=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-exact-public-replay-receipts-20261010.json','utf8'
)) as {
  version:string;studyYears:number[];
  auditedRun:{runId:number;runAttempt:number;headCommit:string;
    sourceArtifactId:number;sourceJsonSha256:string};
  counts:Record<string,number>;
  byDisplayedPublisherYear:Array<{year:number;leads:number;indexConsistentReplays:number}>;
  indexConsistentCaptureReceipts:Receipt[];
  indexUnavailableOrInvalidLeadIds:string[];
  replaySha1Mismatch:Array<{leadId:string;actualArticleBodySha256Verified:boolean}>;
  interpretation:Record<string,boolean>;
};
const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8'
)) as {selectedNonExhaustiveArticleLeads:Array<{
  id:string;publisher:string;livePageUrl:string;
  publicationDayDisplayedOnPublicPage:string;
  originalArchivedHttpBytesHashVerified:boolean;
  directQuoteHumanVerified:boolean;
  historicalForecastEligibilityProven:boolean;
}>};

test('actual run provenance is pinned but this public JSON is no human speech proof',()=>{
  assert.equal(report.version,
    'senate-media-2021-25-public-index-consistent-exact-replay-receipts-v1');
  assert.deepEqual(report.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(report.auditedRun.runId,38109749945);
  assert.equal(report.auditedRun.runAttempt,1);
  assert.equal(report.auditedRun.headCommit,
    '04f8f3e361eb620c27c1deea0e241912aec7427d');
  assert.equal(report.auditedRun.sourceArtifactId,11690592549);
  assert.match(report.auditedRun.sourceJsonSha256,/^[a-f0-9]{64}$/);
  assert.equal(report.counts.privateVotePredictSourceRowsMatched,0);
  assert.equal(report.counts.individualSenatorQuotationsHumanApproved,0);
  for(const key of [
    'derivedOnlyFromCheckedInNonExhaustive31UrlResearchSample',
    'noPrivateSourceDocumentsSHA256MatchPerformed',
    'metadataDigestDoesNotCertifyOriginalHumanSenatorSpeech',
    'historicalForecastEligibilityNotEstablished',
    'publisherArticleAndSenatorStatementUniverseUnknown',
    'unindexedOrFailedLeadsAreNotProvenAbsent',
    'noProductionEvidenceOrForecastChanges',
  ])assert.equal(report.interpretation[key],true,key);
});

test('every selected lead in 31-URL study has EXACTLY one non-promoting outcome',()=>{
  const rows=report.indexConsistentCaptureReceipts;
  const failed=report.indexUnavailableOrInvalidLeadIds;
  const mismatch=report.replaySha1Mismatch;
  assert.equal(ledger.selectedNonExhaustiveArticleLeads.length,31);
  assert.equal(rows.length,19);
  assert.equal(failed.length,11);
  assert.equal(mismatch.length,1);
  const sources=new Map(ledger.selectedNonExhaustiveArticleLeads.map(x=>[x.id,x]));
  const labeled=[...rows.map(x=>x.leadId),...failed,...mismatch.map(x=>x.leadId)];
  assert.equal(labeled.length,31);
  assert.equal(new Set(labeled).size,31);
  assert.deepEqual([...labeled].sort(),[...sources.keys()].sort());
  assert.equal(report.counts.checkedInSelectedPublicUrlLeads,31);
  assert.equal(report.counts.firstPageIndexCandidateUrls,20);
  assert.equal(report.counts.firstPageIndexUnavailableOrInvalidUrls,11);
  assert.equal(report.counts.exactIndexedBodyReplaysAttempted,20);
  assert.equal(report.counts.indexConsistentSha1BodyReplays,19);
  assert.equal(report.counts.oneReplayChecksumMismatch,1);
  for(const r of rows){
    const row=sources.get(r.leadId);
    assert.ok(row);
    assert.match(r.archivedCaptureUtc,/^20(?:21|22|23|24|25)-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.ok(Number.isFinite(Date.parse(r.archivedCaptureUtc)));
    assert.match(r.observedOriginalHtmlSha256,/^[a-f0-9]{64}$/);
    assert.match(r.indexedPayloadSha1Base32,/^[A-Z2-7]{32}$/);
    assert.ok(Number.isSafeInteger(r.observedRawBodyBytes));
    assert.ok(r.observedRawBodyBytes>=40&&r.observedRawBodyBytes<=2_500_000);
    // The first indexed historical replay can occur after publisher's date,
    // NEVER claim it was visible on the previous day.
    assert.equal(r.archivedCaptureUtc.slice(0,4),
      row.publicationDayDisplayedOnPublicPage.slice(0,4));
    assert.equal(row.originalArchivedHttpBytesHashVerified,false);
    assert.equal(row.directQuoteHumanVerified,false);
    assert.equal(row.historicalForecastEligibilityProven,false);
  }
  assert.equal(mismatch[0]?.leadId,'mn-reformer-2023-driver-licenses');
  assert.equal(mismatch[0]?.actualArticleBodySha256Verified,false);
});

test('curated publisher-year buckets count URL examples and matches, not statewide coverage',()=>{
  assert.deepEqual(report.byDisplayedPublisherYear,[
    {year:2021,leads:5,indexConsistentReplays:5},
    {year:2022,leads:8,indexConsistentReplays:4},
    {year:2023,leads:5,indexConsistentReplays:2},
    {year:2024,leads:6,indexConsistentReplays:4},
    {year:2025,leads:7,indexConsistentReplays:4},
  ]);
  for(const y of report.byDisplayedPublisherYear){
    assert.equal(y.leads,ledger.selectedNonExhaustiveArticleLeads
      .filter(x=>x.publicationDayDisplayedOnPublicPage.startsWith(String(y.year))).length);
    assert.equal(y.indexConsistentReplays,report.indexConsistentCaptureReceipts
      .filter(x=>x.archivedCaptureUtc.startsWith(String(y.year))).length);
  }
});

test('three pilot originals used for SHA-pinned visible-text checks match real immutable public receipts',()=>{
  const byId=new Map(report.indexConsistentCaptureReceipts.map(x=>[x.leadId,x]));
  for(const c of PINNED_PUBLIC_ORIGINAL_PAGES){
    const r=byId.get(c.id);assert.ok(r,c.id);
    assert.equal(r.archivedCaptureUtc,c.archivedCaptureUtc);
    assert.equal(r.observedOriginalHtmlSha256,c.expectedOriginalBodySha256);
    assert.equal(r.observedRawBodyBytes,c.expectedOriginalBodyBytes);
    // The record contains no quote body, only original full-page digest.
    assert.equal(Object.hasOwn(r,'exactQuote'),false);
    assert.equal(Object.hasOwn(r,'rawHtml'),false);
  }
});
