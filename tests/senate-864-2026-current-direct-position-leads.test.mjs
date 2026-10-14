import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectWholeOriginalPublisherBody,verifyPositionLedgers,acquireSourceWithBoundedFailure}
 from '../scripts/audit-senate-864-2026-current-direct-position-leads.mjs';

const claimsDoc=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-current-legislative-statements-v1.json',import.meta.url)));
const coverage=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-current-67-senator-public-position-coverage-v1.json',import.meta.url)));
const claims=verifyPositionLedgers(claimsDoc,coverage);
const get=(d,n=0)=>claims.filter(x=>x.district===d)[n];
const stamp='2026-10-13T22:00:00.000Z';
const fake=(body,day='March 27, 2026')=>Buffer.from('<!doctype html><html><body><h2>'+day+'</h2><article>'+body+'</article>'+
 ('Unrelated Senate policy background and committee procedure. '.repeat(17))+'</body></html>');

test('67 sitting senators not confused with the 49 incumbent general-election nominees',()=>{
 assert.equal(coverage.summary.current67,67);
 assert.equal(coverage.summary.currentIncumbentNominees49,49);
 assert.equal(coverage.summary.unreviewedNonNominees,18);
 assert.equal(coverage.summary.currentMembershipCampaignItemSum,378);
 assert.equal(coverage.summary.olderOriginalExcerptsAmong49,716);
 assert.equal(coverage.senators.filter(x=>x.currentTermCampaignIssueItemCount===null).length,18);
 assert.ok(coverage.senators.filter(x=>!x.in49NovemberIncumbentNomineeAudit)
  .every(x=>x.sourceCoverageDispo==='CURRENT_SENATOR_OUTSIDE_49_NOMINEE_AUDIT_NOT_YET_CHECKED'));
});

test('13 direct current issue leads explicitly join the thirteen 2026 dual-gap candidate districts',()=>{
 const dual=[1,2,4,8,11,31,32,46,56,59,61,62,66];
 assert.deepEqual(claims.filter(x=>dual.includes(x.district)).map(x=>x.district)
  .filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b),dual);
 assert.ok(dual.every(d=>coverage.senators[d-1].currentTermCampaignIssueItemCount===0));
 assert.ok(dual.every(d=>coverage.senators[d-1].selectedResearchUrlEvidenceStatus==='Selected URL not observed'));
 assert.equal(coverage.senators[2].senator,'Grant Hauschild');
 assert.equal(coverage.senators[2].currentTermCampaignIssueItemCount,0);
 assert.equal(coverage.senators[2].selectedResearchUrlEvidenceStatus,'Exact URL + linked evidence');
});

test('same exact SF1245 has two opposing personally issued first-party statements',()=>{
 const a=get(3),b=get(8);
 assert.equal(a.canonicalBillId,'SF1245');assert.equal(b.canonicalBillId,'SF1245');
 assert.equal(a.positionAssessment,'explicit_opposition');
 assert.equal(b.positionAssessment,'explicit_support');
 assert.equal(a.eventDate,b.eventDate);assert.equal(a.eventDate,'2026-03-26');
 assert.equal(a.publisherDisplayedDate,b.publisherDisplayedDate);
 const ha=fake('<p>'+a.speakerAttributionCue+'. I said: '+a.shortExactPassage+'</p>');
 const hb=fake('<p>'+b.shortExactPassage+' '+b.speakerAttributionCue+'.</p>');
 assert.equal(inspectWholeOriginalPublisherBody(ha,[a],stamp).results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,true);
 assert.equal(inspectWholeOriginalPublisherBody(hb,[b],stamp).results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,true);
});

test('independent Champion and Fateh attribution within a shared publication; wrong attribution fails closed',()=>{
 const a=get(59),b=get(62);
 assert.equal(a.url,b.url);assert.notEqual(a.shortExactPassage,b.shortExactPassage);
 const txt='<p>'+a.shortExactPassage+' '+a.speakerAttributionCue+'</p>'+
 '<p>'+b.shortExactPassage+' '+b.speakerAttributionCue+'</p>';
 const result=inspectWholeOriginalPublisherBody(fake(txt,'February 20, 2026'),[a,b],stamp);
 assert.deepEqual(result.results.map(x=>x.currentlyPublisherDisplayedPassageAndSpeakerObserved),[true,true]);
 const malicious=inspectWholeOriginalPublisherBody(fake('<p>'+a.shortExactPassage+' '+a.speakerAttributionCue+'</p><p>'+
   b.shortExactPassage+' '+a.speakerAttributionCue+'</p>','February 20, 2026'),[a,b],stamp);
 assert.equal(malicious.results[1].currentlyPublisherDisplayedPassageAndSpeakerObserved,false);
});

test('the same publisher statement has SF3891 and SF3981; do not silently select its inaccurate claim',()=>{
 const egg=get(56,1);
 assert.equal(egg.canonicalBillId,'SF3891');assert.equal(egg.sourceMentionsConflictingBillId,'SF3981');
 const text='<p>SF 3891 permits egg donation.</p><p>'+egg.shortExactPassage+' '+egg.speakerAttributionCue+'</p>'+
 '<p>SF 3981 passed 65-0 and was sent to the House.</p>';
 const obs=inspectWholeOriginalPublisherBody(fake(text,'May 13, 2026'),[egg],stamp);
 assert.equal(obs.results[0].sourceInternalBillNumberConflictDetected,true);
 assert.equal(obs.results[0].disposition,'HOLD_SOURCE_BILL_NUMBER_DISAGREEMENT');
 assert.equal(obs.results[0].firstHistoricalPublicByEstablished,false);
 assert.equal(obs.results[0].productionIngestionAuthorized,false);
});

test('single-bill quote also cannot prove a same-day or earlier archived public-by',()=>{
 const q=get(56,0);
 const orig=fake('<p>'+q.speakerAttributionCue+' '+q.shortExactPassage+'</p>','March 17, 2026');
 const r=inspectWholeOriginalPublisherBody(orig,[q],stamp);
 assert.equal(r.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,true);
 assert.equal(r.results[0].firstHistoricalPublicByEstablished,false);
 assert.equal(r.results[0].archivedVersionOriginalBytesAuthenticated,false);
 assert.equal(r.firstHistoricallyPublicPublisherCopyUtc,null);
 assert.match(r.rawWholePublisherHtmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.rawBodyBytes,orig.length);
 assert.equal(r.sourceExcerptNotStored,true);
});

test('quoted passage found only in script or hidden template is not admissible',()=>{
 const q=get(3);
 const raw=fake('<script>'+q.speakerAttributionCue+' '+q.shortExactPassage+'</script><template>'+
   q.speakerAttributionCue+' '+q.shortExactPassage+'</template>'+
   '<p>This page describes another bill.</p>');
 const r=inspectWholeOriginalPublisherBody(raw,[q],stamp);
 assert.equal(r.results[0].foundExactShortPassage,false);
 assert.equal(r.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,false);
});

test('a 2026 page cannot be proved from 2025 footer or from an unrelated senator',()=>{
 const q=get(8);
 const raw=fake('<p>'+q.shortExactPassage+' '+q.speakerAttributionCue+'</p>',
   'March 27, 2025');
 const r=inspectWholeOriginalPublisherBody(raw,[q],stamp);
 assert.equal(r.results[0].publisherDisplayedDayFoundInLiveHtml,false);
 assert.equal(r.results[0].currentlyPublisherDisplayedPassageAndSpeakerObserved,false);
 const misattrib=fake('<p>'+q.shortExactPassage+' said Senator Grant Hauschild</p>');
 const n=inspectWholeOriginalPublisherBody(misattrib,[q],stamp);
 assert.equal(n.results[0].individuallyNamedAttributionFoundInBoundedVisibleWindow,false);
});

test('original publisher HTTP 403, network and redirect failures are UNKNOWN not evidence of absence',async()=>{
 const c=[get(31)];
 const gone=await acquireSourceWithBoundedFailure(c,async()=>new Response('forbidden',{status:403}));
 assert.equal(gone.status,'HTTP_UNAVAILABLE_UNKNOWN');assert.equal(gone.originalVerified,false);
 const redirect=await acquireSourceWithBoundedFailure(c,async()=>new Response(null,{status:302,headers:{location:'https://bad.example'}}));
 assert.equal(redirect.status,'HTTP_UNAVAILABLE_UNKNOWN');
 const network=await acquireSourceWithBoundedFailure(c,async()=>{throw Error('network unavailable')});
 assert.equal(network.status,'NETWORK_OR_SOURCE_FORMAT_UNKNOWN');
});

test('badly fabricated provenance and missing roster identities fail validation',()=>{
 const fakeLedger=structuredClone(claimsDoc);fakeLedger.claims[0].originalPageRawSha256='not-a-real-hash';
 assert.throws(()=>verifyPositionLedgers(fakeLedger,coverage));
 const fakeRoster=structuredClone(coverage);fakeRoster.senators[4].currentTermCampaignIssueItemCount=0;
 assert.throws(()=>verifyPositionLedgers(claimsDoc,fakeRoster));
 const noOriginal=structuredClone(claimsDoc);noOriginal.claims[0].historicalBacktestEligibleFromThisLedger=true;
 assert.throws(()=>verifyPositionLedgers(noOriginal,coverage));
});


test('first live original-publisher acquisition receipts are preserved with accurate SHA and nine HTTP403 nonabsence holds',()=>{
 const p=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-2026-current-publisher-whole-html-observation-receipts-v1.json',import.meta.url)));
 assert.equal(p.schema,'mn-senate-864-2026-current-publisher-original-html-live-observation-v1');
 assert.equal(p.sourceWorkflowRun,38501897295);
 assert.equal(p.rows.length,14);
 assert.equal(p.summary.originalPublisherUrlsProbed,14);
 assert.equal(p.summary.individuallyAttributedClaimLeads,15);
 assert.equal(p.summary.completeLiveOriginalSHAAndQuoteAuthenticated,5);
 assert.equal(p.summary.originalPublisherHttp403Unknown,9);
 assert.equal(p.summary.original2026WaybackCDXVersionsAuthenticated,0);
 assert.equal(p.summary.independentlyProvedHistoricallyFirstPublicByDates,0);
 assert.equal(p.rawPublisherHtmlCommitted,false);
 assert.equal(new Set(p.rows.map(x=>x.url)).size,14);
 const byId=new Map(claims.map(x=>[x.id,x]));
 const covered=[];
 for(const row of p.rows){
  const ids=[row.primaryClaimId,...(row.additionalClaimIds||[])];
  assert.equal(row.url,byId.get(row.primaryClaimId)?.url);
  for(const id of ids){assert.equal(row.url,byId.get(id)?.url);covered.push(id);}
  assert.ok(row.observedAtUtc.startsWith('2026-10-14T02:36:'));
  assert.equal(row.originalArchiveCaptureAuthenticated,false);
  assert.equal(row.originalVersionFirstPublicationTimeAuthenticated,false);
  assert.equal(row.evidenceAdmittedToHistoricalBacktest,false);
  if(row.httpStatus===200){
   assert.match(row.liveOriginalWholeHtmlSha256,/^[a-f0-9]{64}$/);
   assert.ok(row.liveOriginalWholeHtmlBytes>100_000);
   assert.ok(row.url.startsWith('https://www.mnsenaterepublicans.com/'));
  }else{
   assert.equal(row.httpStatus,403);
   assert.equal(row.liveOriginalWholeHtmlSha256,null);
   assert.equal(row.liveOriginalWholeHtmlBytes,null);
   assert.ok(row.url.startsWith('https://senatedfl.mn/'));
  }
 }
 assert.equal(new Set(covered).size,15);
 assert.deepEqual(new Set(covered),new Set(claims.map(x=>x.id)));
});
