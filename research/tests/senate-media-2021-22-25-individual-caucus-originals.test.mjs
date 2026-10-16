import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LEADS,VERSION,validateLeads,probeIndividualCaucusOriginal,runSevenCaucusIndividualSourceOriginals}
 from '../../scripts/probe-senate-media-2021-22-25-individual-caucus-originals.mjs';
const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',headers=['timestamp','original','mimetype','statuscode','digest','length'];
function sha1base32(raw){let n=0,b=0,s='';for(const x of createHash('sha1').update(raw).digest()){
 n=n<<8|x;b+=8;while(b>=5){b-=5;s+=A[n>>>b&31];}n&=(1<<b)-1;}if(b)s+=A[n<<(5-b)&31];return s;}
test('seven exact new or selected prior individual State Senate direct caucus policy pages (2021–22 and 2025)',()=>{
 assert.equal(VERSION,'senate-media-2021-22-25-seven-first-party-individual-originals-v1');
 assert.equal(validateLeads().length,7);
 assert.deepEqual(LEADS.map(x=>x.senator),['Foung Hawj','Paul Gazelka','Bill Weber','Julia Coleman','Susan Pha','Susan Pha','Julia Coleman']);
 assert.equal(new Set(LEADS.map(x=>x.senator)).size,5);
 assert.deepEqual(LEADS.map(x=>x.displayedDay),[
  '2021-01-05','2022-01-14','2022-12-06','2025-01-22','2025-03-20','2025-05-06','2025-08-27'
 ]);
 assert.equal(LEADS[0].quoted[0].lrl,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15380');
 assert.equal(LEADS[1].quoted[0].lrl,'https://www.lrl.mn.gov/legdb/fulldetail?ID=12263');
 assert.equal(LEADS[2].quoted[0].lrl,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15388');
 assert.throws(()=>validateLeads(LEADS.slice(1)));
 assert.throws(()=>validateLeads([LEADS[0],LEADS[0],...LEADS.slice(2)]));
});
test('prospective and post-passage/event statements differ; cannot use post-event text for earlier vote prediction',()=>{
 assert.ok(LEADS.slice(0,3).every(x=>!x.postEvent));
 assert.ok(LEADS.slice(3).every(x=>x.postEvent));
 assert.equal(LEADS[5].id,'2025-pha-hoa-passage-remarks');
 assert.equal(LEADS[4].id,'2025-pha-post-charges-child-protection');
 assert.equal(LEADS[6].id,'2025-coleman-post-annunciation-school-security');
 assert.equal(LEADS[3].id,'2025-coleman-education-committee-mandates');
});
test('archived original must match source exact first-party URL, SHA1 indexed body and SHA256 download before reported positive',async()=>{
 const l=LEADS[1],body=Buffer.from('<!doctype html><html><body><p>Senator Paul Gazelka said the proposed bill introduces minimum sentencing for carjackings.</p></body></html>'+' '.repeat(6000));
 const digest=sha1base32(body),sha=createHash('sha256').update(body).digest('hex'),timestamp='20220120134109';
 const fake=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');
  if(url.startsWith('https://web.archive.org/cdx/search/cdx?')){
   assert.equal(new URL(url).searchParams.get('url'),l.url);
   return new Response(JSON.stringify([headers,[timestamp,l.url,'text/html','200',digest,String(body.length)]]),{headers:{'content-type':'application/json'}});
  }
  if(url.startsWith('https://web.archive.org/web/'))
   return new Response(body,{headers:{'content-type':'text/html'}});
  if(url.startsWith('https://index.commoncrawl.org/'))return new Response('unavailable',{status:503});
  return new Response(body,{headers:{'content-type':'text/html'}});
 };
 const res=await probeIndividualCaucusOriginal(l,fake);
 assert.equal(res.authenticatedOriginalBodyCaptureCount,1);
 assert.equal(res.earliestVerifiedOriginalHtmlCaptureUtc,'2022-01-20T13:41:09Z');
 assert.equal(res.originalWayback.originals[0].bodySha256,sha);
 assert.equal(res.originalWayback.originals[0].shortCurrentSelectedPolicyFragmentFoundOnOriginalPage,true);
 assert.equal(res.actualMemberRecordedVoteNotVerified,true);
 assert.equal(res.statementTextNotVerbatimAudioOrForecastInput,true);
});
test('no historical archive first-party response is UNKNOWN, not proof source absent; source original metadata alone cannot establish forecast',async()=>{
 const f=async()=>new Response('temporarily unavailable',{status:503});
 const result=await runSevenCaucusIndividualSourceOriginals(f);
 assert.equal(result.countExactFirstPartyOriginalLeadUrls,7);
 assert.equal(result.distinctNamedServingStateSenators,5);
 assert.equal(result.alreadyKnownSelectedLeadCount,2);
 assert.equal(result.additionalSelectedIndividualPressReleaseUrls,5);
 assert.equal(result.authenticatedHistoricPublisherOriginalBodies,0);
 assert.equal(result.distinctOriginalUrlsHistoricallyAuthenticated,0);
 assert.ok(result.sources.every(s=>s.earliestVerifiedOriginalHtmlCaptureUtc===null));
 assert.ok(result.sources.every(s=>s.originalWayback.status==='index_unavailable_unknown'));
 assert.ok(result.sources.every(s=>s.originalCommonCrawl.selectedCollections.every(x=>x.index==='index_unavailable_unknown')));
 assert.equal(result.noPublisherDisplayedDateSubstitutedForArchiveCapture,true);
 assert.equal(result.noPrivateSourceOrDbOrModelOrCollectorChanges,true);
 assert.equal(result.noRawArticleHtmlOrMediaPersisted,true);
});
