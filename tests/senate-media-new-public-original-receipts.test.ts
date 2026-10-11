/** #987: checked-in ORIGINAL Actions output receipts, NOT synthetic source claims. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

type Capture={
  archivedCaptureUtc:string;
  indexedPayloadSha1Base32:string;
  observedOriginalBodySha256:string;
  observedOriginalBodyBytes:number;
};
type Matched={
  leadId:string;
  indexedCandidatesOnBoundedFirstPage:number;
  verifiedCaptureReplays:Capture[];
};
type Hold={
  leadId:string;archiveCapturedUtc:string;status:string;indexedPayloadSha1Base32:string;
};
const d=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-new-public-original-replay-receipts-20261011.json','utf8',
));
const leads=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json','utf8',
)).selectedNewPublicSourcePages as Array<{id:string;displayedPublisherDates:string[];individualSenatorSpeaker:string|null}>;
const matched=d.matchedOriginalCaptureReceipts as Matched[];
const holds=d.indexedButUnverifiedReplayHolds as Hold[];
const failures=d.indexUnavailableOrInvalidIds as string[];

test('new real public archive run receipt independently pins the original ZIP and exact JSON bytes',()=>{
  assert.equal(d.version,'senate-media-2021-25-new-public-original-replay-receipts-v1');
  assert.equal(d.observationDateLocal,'2026-10-11');
  assert.deepEqual(d.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(d.selectedCohort,'18_non_exhaustive_original_publisher_media_pages_after_PR_1058');
  assert.equal(d.exactSourceRun.repo,'killjoy00/votepredict');
  assert.equal(d.exactSourceRun.workflow,'senate-media-new-public-remarks-wayback.yml');
  assert.equal(d.exactSourceRun.runId,38156337828);
  assert.equal(d.exactSourceRun.runAttempt,1);
  assert.equal(d.exactSourceRun.sourceHeadSha,'1e4368694a6da57b59bc33296e425d408619a973');
  assert.equal(d.exactSourceRun.sourceArtifactId,11708690733);
  assert.equal(d.exactSourceRun.sourceArtifactName,'senate-media-new-remarks-public-wayback');
  assert.equal(d.exactSourceRun.originalArtifactZipSha256,
    'a204368dab2c8b68823eb3661cb32d04d77890bfc34c1a423e4acb14d8f16523');
  assert.equal(d.exactSourceRun.decodedJsonSha256,
    '4b65981dbb3ca9424af4947d986b9a3b0eae8307efc9490b722025a49b82720f');
  assert.equal(d.exactSourceRun.decodedJsonByteCount,38745);
});

test('all 18 preselected URLs are classified exactly once; never infer five missing articles',()=>{
  assert.equal(leads.length,18);
  const ids=new Set(leads.map(x=>x.id));
  assert.equal(ids.size,18);
  assert.equal(matched.length,13);
  assert.equal(failures.length,5);
  assert.equal(holds.length,3);
  const recorded=matched.map(x=>x.leadId).concat(failures);
  assert.equal(recorded.length,18);
  assert.equal(new Set(recorded).size,18);
  assert.deepEqual([...recorded].sort(),[...ids].sort());
  assert.deepEqual(d.observedTotals,{
    urlLeadsProbed:18,candidatesIndexed:13,indexEmpty:0,indexUnavailableOrInvalid:5,
    exactReplayAttempts:26,indexConsistentBodyReplays:23,
    distinctUrlLeadsWithIndexConsistentBodies:13,sha1ReplayMismatches:2,
    archiveRedirectHolds:1,originalBodySha256Count:23,
    humanApprovedSenatorQuotations:0,firstPublisherPostClockAuthenticated:0,
  });
  assert.deepEqual(d.displayedPublisherYearSample.map((x:{year:number;selectedUrls:number;matchedOriginalUrlLeads:number})=>
    [x.year,x.selectedUrls,x.matchedOriginalUrlLeads]),
    [[2021,4,4],[2022,3,2],[2023,4,3],[2024,3,2],[2025,4,2]]);
  const byYear=new Map<number,number>();
  for(const lead of leads){
    const y=Number(lead.displayedPublisherDates[0]!.slice(0,4));
    byYear.set(y,(byYear.get(y)??0)+1);
  }
  for(const row of d.displayedPublisherYearSample){
    assert.equal(row.selectedUrls,byYear.get(row.year));
    assert.equal(row.matchedOriginalUrlLeads,
      matched.filter(x=>x.leadId.includes('-'+String(row.year)+'-')).length);
  }
});

test('23 real index-consistent original body SHA-256 receipts retain distinct capture time and exact payload SHA-1',()=>{
  assert.equal(matched.reduce((n,x)=>n+x.verifiedCaptureReplays.length,0),23);
  assert.equal(matched.filter(x=>x.verifiedCaptureReplays.length===1).length,3);
  assert.equal(matched.filter(x=>x.verifiedCaptureReplays.length===2).length,10);
  for(const row of matched){
    assert.ok(row.indexedCandidatesOnBoundedFirstPage>=row.verifiedCaptureReplays.length);
    assert.ok(row.indexedCandidatesOnBoundedFirstPage<=20);
    assert.ok(row.verifiedCaptureReplays.length>=1 && row.verifiedCaptureReplays.length<=2);
    let prev='';
    for(const cap of row.verifiedCaptureReplays){
      assert.match(cap.archivedCaptureUtc,/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      assert.equal(new Date(cap.archivedCaptureUtc).toISOString(),cap.archivedCaptureUtc.replace('Z','.000Z'));
      assert.ok(cap.archivedCaptureUtc>prev);
      prev=cap.archivedCaptureUtc;
      assert.match(cap.indexedPayloadSha1Base32,/^[A-Z2-7]{32}$/);
      assert.match(cap.observedOriginalBodySha256,/^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(cap.observedOriginalBodyBytes));
      assert.ok(cap.observedOriginalBodyBytes>=40&&cap.observedOriginalBodyBytes<=2500000);
      assert.equal(Object.hasOwn(cap,'rawHtml'),false);
      assert.equal(Object.hasOwn(cap,'actualQuoteText'),false);
    }
  }
});

test('unverified replays and index failures are held out of historic page and quote approval',()=>{
  assert.deepEqual(failures,[
    'caucus-2022-dahms-session-agenda',
    'caucus-2023-pratt-february-budget',
    'caucus-2024-housley-session-procedure',
    'caucus-2025-clark-oath-statement',
    'caucus-2025-pha-justice-statement',
  ]);
  assert.equal(holds.filter(x=>x.status==='cdx_payload_sha1_mismatch').length,2);
  assert.equal(holds.filter(x=>x.status==='archive_redirect_refused').length,1);
  for(const h of holds){
    assert.ok(matched.some(x=>x.leadId===h.leadId));
    assert.match(h.indexedPayloadSha1Base32,/^[A-Z2-7]{32}$/);
    assert.match(h.archiveCapturedUtc,/^20(?:21|22|23|24|25)-/);
    assert.equal(Object.hasOwn(h,'observedOriginalBodySha256'),false);
  }
  const policy=d.interpretation;
  for(const [k,v] of Object.entries(policy)){
    assert.equal(v,true,'Public research negative proof flag '+k);
  }
  assert.ok(leads.some(x=>x.id==='caucus-2023-poci-joint-policing'
    && x.individualSenatorSpeaker===null));
  assert.ok(leads.some(x=>x.id==='caucus-2025-rochester-multi-chamber-joint'
    && x.individualSenatorSpeaker===null));
  assert.equal(Object.hasOwn(d,'humanVerifiedStatementText'),false);
  assert.equal(Object.hasOwn(d,'privateSourceDocumentIds'),false);
});

test('same-day Miller MPR and Marty releases have real earliest captures but NOT verified quotation audio',()=>{
  const miller=matched.find(x=>x.leadId==='mpr-2021-miller-hero-pay-interview')!;
  const marty=matched.find(x=>x.leadId==='caucus-2021-marty-malcolm')!;
  const coleman=matched.find(x=>x.leadId==='caucus-2021-coleman-sexual-assault')!;
  assert.deepEqual(miller.verifiedCaptureReplays.map(x=>x.archivedCaptureUtc),[
    '2021-11-15T21:55:12Z','2021-11-15T23:26:33Z']);
  assert.equal(miller.verifiedCaptureReplays[0]!.indexedPayloadSha1Base32,
    miller.verifiedCaptureReplays[1]!.indexedPayloadSha1Base32);
  assert.equal(miller.verifiedCaptureReplays[0]!.observedOriginalBodySha256,
    'a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf');
  assert.equal(miller.verifiedCaptureReplays[1]!.observedOriginalBodyBytes,91141);
  assert.equal(marty.verifiedCaptureReplays[0]!.archivedCaptureUtc,'2021-11-16T22:45:21Z');
  assert.equal(marty.verifiedCaptureReplays[0]!.observedOriginalBodySha256,
    '83d21412e1ba4b94b008169e8a9c4018a6b88a23de665c930abf2a6c3e22fa98');
  assert.equal(coleman.verifiedCaptureReplays[0]!.archivedCaptureUtc,'2021-04-13T20:21:28Z');
  assert.equal(d.observedTotals.humanApprovedSenatorQuotations,0);
});
