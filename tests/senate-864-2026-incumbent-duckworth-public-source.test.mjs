import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditPublicOriginalHtml,verifyManifest,normalizeVisibleHtml,fetchOne}
 from '../scripts/probe-senate-864-2026-duckworth-dated-original-public-statements.mjs';

const manifest=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json',import.meta.url),'utf8'));
const sources=verifyManifest(manifest);
const s=sources[2];const asOf='2026-10-12T20:00:00.000Z';
const html=(who='Sen. Zach Duckworth',line=s.shortIssueCue,date='March 17, 2026')=>
 Buffer.from('<!doctype html><html><head><script>JUNK TRICK</script></head><body>'+
 '<h2>'+date+'</h2><h1>Education news</h1>'+
 '<p>'+who+' authored SHIELD school safety bill.</p><p>Duckworth: '+line+
 '. It offers state grant aid to schools for improved door security.</p>'+
 '<p>background '+('legislation and school safety. '.repeat(20))+'</p></body></html>','utf8');

test('official person population, older site source, 2026 database snapshot limitations stay distinct',()=>{
 assert.equal(manifest.population.currentIncumbentGeneralNominees,49);
 assert.equal(manifest.population.withVerifiedOlderCandidateOwnedCampaignWebsiteExcerpts,49);
 assert.equal(manifest.population.totalSelectedOriginalHistoricalCampaignSiteExcerpts,716);
 assert.equal(manifest.sourceReferenceBoundedGitHubCodeSearch.observedReferencesOrOldDomains,22);
 assert.equal(manifest.sourceReferenceBoundedGitHubCodeSearch.notObservedInSearch,27);
 assert.equal(manifest.duckworth.selectedOlderOriginalSiteExcerpts,14);
 assert.equal(manifest.duckworth.original2022CaptureUtc,'2022-01-18T02:14:14.000Z');
 assert.match(manifest.duckworth.original2022PageSha256,/^[a-f0-9]{64}$/);
 assert.equal(manifest.existingProtectedAggregate.deployedProductionBindingVerified,false);
 assert.equal(manifest.existingProtectedAggregate.personByPersonMatchedAgainstNew2026Leads,0);
});
test('four exact original URL hypotheses and named Duckworth witnesses, excluding stale 2025 text',()=>{
 assert.equal(sources.length,4);
 assert.deepEqual(sources.map(x=>x.dateDisplayed),['2026-01-25','2026-01-26','2026-03-17','2026-05-16']);
 assert.ok(sources.every(x=>x.speakerCue.toLowerCase().includes('duckworth')));
 assert.equal(manifest.duckworth.excludedFalsePositives.length,3);
 assert.ok(manifest.duckworth.excludedFalsePositives.some(x=>x.reason.includes('Koznick')));
 assert.ok(manifest.duckworth.excludedFalsePositives.some(x=>x.dateDisplayed.startsWith('2025-')));
 assert.equal(manifest.boundaries.jan25Jan26SamePolicyClusterNotTwoUnrelatedPositions,true);
});
test('whole HTML SHA/body and date/local named speaker can be verified without text leak or auto-ingest',()=>{
 const r=auditPublicOriginalHtml(s,html(),asOf);
 assert.equal(r.rawWholeHtmlBytes,html().length);
 assert.match(r.rawWholeOriginalHtmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.expectedNamedSpeakerCueVisible,true);
 assert.equal(r.displayedCalendarDateVisibleInAcquiredBody,true);
 assert.equal(r.issueCueInDuckworthSpeakerNeighborhood,true);
 assert.equal(r.originalPublisherHtmlAndSpeakerCueAuthenticated,true);
 assert.equal(r.originalExact2026FirstAuthoredTimestampProven,false);
 assert.equal(r.automaticallyStoredVotePredictEvidence,false);
 assert.ok(!JSON.stringify(r).includes(s.shortIssueCue));
});
test('2025 publication with 2026 footer must not be promoted to 2026 source',()=>{
 const r=auditPublicOriginalHtml(s,html(s.speakerCue,s.shortIssueCue,'May 1, 2025') ,asOf);
 assert.equal(r.displayedCalendarDateVisibleInAcquiredBody,false);
 assert.equal(r.originalPublisherHtmlAndSpeakerCueAuthenticated,false);
});
test('unrelated speaker cannot be represented as Duckworth direct quote',()=>{
 const r=auditPublicOriginalHtml(s,html('Sen. Housley',s.shortIssueCue),asOf);
 assert.equal(r.expectedNamedSpeakerCueVisible,false);
 assert.equal(r.originalPublisherHtmlAndSpeakerCueAuthenticated,false);
});
test('speaker mention far from a reporter quote is insufficient local attribution',()=>{
 const raw=Buffer.from('<h2>March 17, 2026</h2>Sen. Zach Duckworth. '+('irrelevant introduction '.repeat(160))+
  '<p>Sen. Housley. '+s.shortIssueCue+' for policy.</p>','utf8');
 const r=auditPublicOriginalHtml(s,raw,asOf);
 assert.equal(r.expectedNamedSpeakerCueVisible,true);
 assert.equal(r.issueCueVisible,true);
 assert.equal(r.issueCueInDuckworthSpeakerNeighborhood,false);
 assert.equal(r.originalPublisherHtmlAndSpeakerCueAuthenticated,false);
});
test('HTML script source cannot manufacture a visible Duckworth statement',()=>{
 const raw=Buffer.from('<h2>March 17, 2026</h2><script>Sen. Zach Duckworth '+s.shortIssueCue+'</script>'+
 ('visible news '.repeat(95)),'utf8');
 const r=auditPublicOriginalHtml(s,raw,asOf);
 assert.equal(r.expectedNamedSpeakerCueVisible,false);
 assert.equal(r.issueCueVisible,false);
 assert.equal(r.originalPublisherHtmlAndSpeakerCueAuthenticated,false);
});
test('HTTP errors, redirects, and unavailable original bodies are explicitly UNKNOWN',async()=>{
 const err=await fetchOne(s,async()=>new Response('<h2>error</h2>',{status:503,headers:{'content-type':'text/html'}}));
 assert.equal(err.exactSourceOriginalAuthenticated,false);
 assert.equal(err.status,'public_source_http_unavailable_unknown');
 assert.equal(err.httpStatus,503);
 const redirect=await fetchOne(s,async()=>new Response('',{status:302,headers:{Location:'https://example.com'}}));
 assert.equal(redirect.status,'public_source_http_unavailable_unknown');
 const noNet=await fetchOne(s,async()=>{throw Error('unavailable')});
 assert.equal(noNet.status,'public_source_network_unavailable_unknown');
});
test('valid original dates and no unsafe or different-party candidate source URLs',()=>{
 assert.throws(()=>verifyManifest({...manifest,duckworth:{...manifest.duckworth,newDated2026SourceLeads:
  sources.map((x,i)=>i===0?{...x,url:'https://www.duckworth.senate.gov/'}:x)}}));
 assert.throws(()=>auditPublicOriginalHtml({...s,url:'https://bad.example/2026'},html(),asOf));
 assert.equal(normalizeVisibleHtml('Sen.&nbsp;Zach &rsquo; Duckworth').includes('Duckworth'),true);
});
test('all user-specified safety constraints remain explicit',()=>{
 const p=manifest.boundaries;
 assert.equal(p.publisher2026DisplayedDateNotExactFirstPublishedInstant,true);
 assert.equal(p.liveOriginalFetchNeedsWholeBodyShaAndIdentityScopeProof,true);
 assert.equal(p.caucusNotCandidateOwnedCampaignWebsite,true);
 assert.equal(p.sourceResearchNotIngestion,true);
 assert.equal(p.noProductionDatabaseReadsOrWrites,true);
 assert.equal(p.noOutsideContactOrEmail,true);
 assert.equal(p.noForecastModelSchedulerChanges,true);
});
