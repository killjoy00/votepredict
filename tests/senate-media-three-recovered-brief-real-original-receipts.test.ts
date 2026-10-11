/** Pinned genuine 2021/2022/2025 Reformer public /briefs/ original archive evidence (#987/#946). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=(name:string)=>JSON.parse(readFileSync('docs/evaluation/'+name,'utf8')) as any;
const proof=read('senate-media-three-original-reformer-brief-historical-recovery-receipts-20261011.json');
const queue=read('senate-media-three-unverified-reformer-brief-original-archive-hypotheses-20261011.json');
const sources=read('senate-media-2021-25-further-independent-reporting-15-leads.json');
test('two independently downloaded real public Wayback artifacts contain original 2021/22/25 brief body proof',()=>{
 const runs=proof.independentFirstAndSecondSourceRuns;
 assert.equal(proof.version,'senate-media-three-reformer-brief-original-http-recovery-receipts-v1');
 assert.equal(runs.length,2);
 assert.equal(runs[0].runId,38168840912);
 assert.equal(runs[0].artifactId,11713003975);
 assert.equal(runs[0].success,true);
 assert.equal(runs[0].zipSha256,'9cdf7466dd2195133c87405452be4617090602abf5de28583ce683098eb3dac0');
 assert.equal(runs[0].jsonSha256,'ae95d9c45026f32ed24069bbf58308c8f1001d8e9a194bccfcb714ea91cb0e51');
 assert.equal(runs[0].jsonBytes,13290);
 assert.equal(runs[0].sourceOriginalBriefUrlVariantsVerified,2);
 assert.equal(runs[0].sourceOriginalBodiesMatched,3);
 assert.equal(runs[1].runId,38168876117);
 assert.equal(runs[1].artifactId,11712949670);
 assert.equal(runs[1].success,true);
 assert.equal(runs[1].zipSha256,'aebcbb4563888c65462d5723641c2907815c3bd3528e6028e94c15099c10013e');
 assert.equal(runs[1].jsonSha256,'d8f94a01a65f1f482421dd383753805ba925c16b3f37368d3128641701665c24');
 assert.equal(runs[1].jsonBytes,16858);
 assert.equal(runs[1].sourceOriginalBriefUrlVariantsVerified,3);
 assert.equal(runs[1].sourceOriginalBodiesMatched,5);
});
test('all three brief URL candidates now have one or more genuine original SHA1 matched 2021-25 bodies, dated originals remain unknown',()=>{
 const p=proof.perSourceOriginalUrlVariantPairs as any[];
 assert.equal(p.length,3);
 assert.equal(sources.newIndividuallyNamedSenatorSpeakerCandidates,24);
 assert.deepEqual(p.map((x:any)=>x.sourceArticleId),
  ['new-reporter-2021-commissioners','new-reporter-2022-special-session','new-reporter-2025-sick-leave']);
 let positives=0,failures=0,short=0;
 for(const row of p){
  const pending=queue.sourcePairs.find((x:any)=>x.originalReporterArticleLeadId===row.sourceArticleId);
  const source=sources.independentOriginalReporterArticleLeads.find((x:any)=>x.id===row.sourceArticleId);
  assert.ok(pending&&source);
  assert.equal(row.originallySelectedDatedUrl,source.originalPublisherUrl);
  assert.equal(row.originalPublisherBriefsPath,pending.proposedAlternativeOriginalBriefUrl);
  assert.equal(row.originalDatedUrlHistoricalCdx,'index_unavailable_unknown');
  assert.equal(row.historicalBriefsPathCdx,'indexed_candidates');
  assert.deepEqual(row.selectedServingSenators,source.namedSenatorSpeakerTurnCandidates.map((x:any)=>x.name));
  assert.equal(row.bothExactUrlVariantsHistoricallyVerified,false);
  assert.equal(row.historicallySameArticleUrlAliasProven,false);
  assert.equal(row.originalPublisherInitialPostingClockProven,false);
  assert.equal(row.originalBriefsHttpCaptureVersions.length,2);
  for(const cap of row.originalBriefsHttpCaptureVersions){
    assert.match(cap.originalIndexedSha1Base32,/^[A-Z2-7]{32}$/);
    assert.match(cap.captureUtc,/^20(?:21|22|23|24|25)-\d\d-\d\dT/);
    assert.equal(cap.individualSenatorShortCueOutcomes.length,row.selectedServingSenators.length);
    if(cap.replayStatus==='actual_original_indexed_sha1_verified'){
      positives++;
      assert.match(cap.rawOriginalSha256,/^[a-f0-9]{64}$/);
      assert.ok(cap.rawOriginalHttpBytes>40&&cap.rawOriginalHttpBytes<=2_500_000);
      assert.ok(cap.individualSenatorShortCueOutcomes.every((x:any)=>
        x.fragmentInHistoricallyVerifiedHtml===true&&x.surnameSameParagraph===true));
    }else{
      failures++;
      assert.equal(cap.replayStatus,'archive_raw_sha1_mismatch_unknown');
      assert.equal(cap.rawOriginalSha256,null);
      assert.ok(cap.individualSenatorShortCueOutcomes.every((x:any)=>
        x.fragmentInHistoricallyVerifiedHtml===null&&x.surnameSameParagraph===null));
    }
    short+=cap.individualSenatorShortCueOutcomes.filter((x:any)=>x.fragmentInHistoricallyVerifiedHtml===true).length;
    assert.ok(cap.individualSenatorShortCueOutcomes.every((x:any)=>
      x.independentOriginalAudioVerified===false&&x.fullSpeechQuoteHumanApproved===false
      &&x.actualMemberVoteVerified===false));
  }
 }
 assert.equal(positives,5);assert.equal(failures,1);assert.equal(short,9);
});
test('first 2021 commissioner original and latest 2025 sick leave genuine source SHA remain tied to exact captured UTC',()=>{
 const p=proof.perSourceOriginalUrlVariantPairs;
 const commissioners=p[0].originalBriefsHttpCaptureVersions;
 assert.equal(commissioners[0].captureUtc,'2021-07-02T19:52:54Z');
 assert.equal(commissioners[0].rawOriginalSha256,'8431768c84c596604ac4b3061cf3e6b0512316dcd2e1dffc3349ff470ddbd45e');
 assert.equal(commissioners[1].rawOriginalSha256,'d23ca75166bac663a0928a6af9a9f4871f6350ef30820c864debc66a4b7bf7cf');
 const sick=p[2].originalBriefsHttpCaptureVersions;
 assert.equal(sick[0].captureUtc,'2025-05-07T03:42:47Z');
 assert.equal(sick[0].rawOriginalSha256,'66db985360ccece1f58db94b8208630c4fee1e5c1faeef5ea5b133b6a49c9583');
 assert.equal(sick[1].replayStatus,'archive_raw_sha1_mismatch_unknown');
 assert.equal(sick[1].captureUtc,'2025-05-07T09:00:33Z');
});
test('headline/current publisher brief crosslink not historic identity, original audio, member roll call or first release clocks',()=>{
 assert.deepEqual(proof.observedTotals,{
  historicallyUnverifiedDatedUrlLeads:3,proposedDistinctOriginalBriefUrls:3,
  exactSha1MatchedNewOriginalBriefHttpBodies:5,briefReplayAttempts:6,
  individualServingSenatorQuoteCandidates:6,
  exactHistoricallyPresentShortSpeakerCueChecks:9,unverifiedRawOriginalDigestMismatchBodies:1,
  originalDatedUrlBodyVerifications:0,datedVsBriefArticleUrlHistoricalAliasProofs:0,
  originalSpokenAudioVerifications:0,humanFullQuotationApprovals:0,
  memberRecordedVotesProven:0,publisherFirstPostingClocksProven:0
 });
 for(const [key,flag] of Object.entries(proof.interpretation))
  assert.equal(flag,true,'Source original path uncertainty '+key);
 assert.equal(Object.hasOwn(proof,'originalPublisherArticleHtml'),false);
});
