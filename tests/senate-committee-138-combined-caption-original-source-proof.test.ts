import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=(p:string)=>readFileSync(new URL('../docs/evaluation/source-proof/'+p,import.meta.url));
const blob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const firstRaw=read('senate-committee-138-original-caption-surface-first-run-ledger.json');
const finalRaw=read('senate-committee-138-caption-combined-successful-original-source-proof.json');
const first=JSON.parse(firstRaw.toString('utf8')),proof=JSON.parse(finalRaw.toString('utf8'));
test('actual incomplete original first run is never retrospectively re-labeled success',()=>{
 assert.equal(blob(firstRaw),'67eadd165c115e12edeafdd41648a288a9b1c9d6');
 assert.equal(blob(finalRaw),'7bb8fb0ff89b04355643b7b6601c187a014a47d4');
 assert.equal(proof.issue,864);
 assert.equal(proof.schemaVersion,'senate-2022to25-138-official-media-caption-combined-two-original-runs-proof-v1');
 assert.equal(first.runId,38103766440);
 assert.equal(first.runOverallConclusion,'failure');
 assert.equal(proof.sourceFirstRunId,38103766440);
 assert.equal(proof.sourceFirstRunOverallConclusion,'failure');
 assert.equal(proof.sourceRetryRunId,38104325591);
 assert.equal(proof.sourceRetryRunConclusion,'success');
 assert.equal(proof.sourceRetryImplementationPR,1005);
 assert.equal(proof.sourceRetryMergeSha,'0b5b7885321141ce7b15f8fc4bddd51ed6497fdc');
 assert.equal(proof.actualRetryArtifactId,11688688635);
 assert.equal(proof.actualRetryArtifactZipSha256,
 '514c359aeb5c5743ec6538137d9359fe1a82bba186a14eccc2efdedc5ecbc588');
 assert.equal(proof.actualRetryUncompressedJsonSha256,
 '4c4564531edd35c1c14cf1cc08defc62e107516c1cd371dfd1b9b6e428eeff4e');
 assert.equal(proof.actualRetryUncompressedJsonBytes,2704);
 assert.equal(proof.safeguards.successfulRetryIsNotSameAsSuccessfulInitialFullFourYearRun,true);
});
test('only exact two prior source failures are closed by separately SHA verified original HTML + captions',()=>{
 const records=proof.reviewedOriginalRetryResults;
 assert.equal(records.length,2);
 assert.deepEqual(records.map((r:any)=>[r.year,r.hearingDate,r.committeeName,r.mtgid,r.captionTimestampMarkers]),[
  [2023,'2023-01-12','Taxes','1046920',1612],
  [2023,'2023-02-08','Taxes','1047266',3233]
 ]);
 assert.deepEqual(first.exceptions.filter((e:any)=>e.hold==='original_html_fetch_failed')
   .map((e:any)=>e.mtgid),records.map((r:any)=>r.mtgid));
 for(const row of records){
   assert.equal(row.originalHtmlReverified,true);
   assert.equal(row.captionSourceClassification,'caption_timed_rows_observed');
   assert.match(row.originalHtmlSha256,/^[a-f0-9]{64}$/);
   assert.match(row.captionSourceBodySha256,/^[a-f0-9]{64}$/);
   assert.ok(row.captionPayloadBytes>100);
 }
 assert.equal(records.reduce((n:number,x:any)=>n+x.captionTimestampMarkers,0),4845);
});
test('all 138 indexed media record HTML sources now reverified; seven true remaining caption source holds',()=>{
 const a=proof.combinedByYear;
 assert.deepEqual(a.map((r:any)=>[r.year,r.indexedOfficialMediaLeads,r.actualOriginalHtmlSHAReverifiedAcrossRuns,
 r.pagesWithTimedCaptionRows,r.withoutTimedCaptionRows]),[
 [2022,11,11,10,1],[2023,64,64,58,6],[2024,41,41,41,0],[2025,22,22,22,0]
 ]);
 for(let i=0;i<a.length;i++){
   assert.equal(a[i].indexedOfficialMediaLeads,first.years[i].expectedMediaPages);
   assert.equal(a[i].actualOriginalHtmlSHAReverifiedAcrossRuns,
      first.years[i].htmlVerified+(i===1?2:0));
   assert.equal(a[i].pagesWithTimedCaptionRows,
      first.years[i].pagesWithTimedCaptions+(i===1?2:0));
 }
 const sum=(key:string)=>a.reduce((n:number,r:any)=>n+r[key],0);
 assert.equal(sum('indexedOfficialMediaLeads'),138);
 assert.equal(sum('actualOriginalHtmlSHAReverifiedAcrossRuns'),138);
 assert.equal(sum('pagesWithTimedCaptionRows'),131);
 assert.equal(sum('withoutTimedCaptionRows'),7);
 assert.equal(first.years.reduce((n:number,x:any)=>n+x.totalTimestampMarkers,0)+4845,361175);
 assert.equal(proof.combinedSummary.totalCaptionTimestampMarkersAcrossBothSourceRuns,361175);
 assert.equal(proof.combinedSummary.pendingOriginalHtmlFetchErrorsAfterTargetedRetry,0);
 assert.equal(proof.combinedSummary.individual2023AudioOnlyPagesWithoutSafeVideoCaption,5);
 assert.equal(proof.combinedSummary.separateNoTimestampHtmlCaptionResponses,2);
});
test('caption timestamps and absent electronic minutes never imply unique motions or individual choices',()=>{
 assert.equal(proof.combinedSummary.timestampsNotAVPlaybackOrVerifiedSpokenWords,true);
 assert.equal(proof.combinedSummary.officialRecordedCommitteeVoteDenominator2021to2025,null);
 assert.equal(proof.combinedSummary.independentlyVerifiedNamedSenatorYeaNayFromThisSourceAudit,0);
 assert.equal(proof.combinedSummary.humanMotionTimeSemanticsAndSpeakerReviewStillNeeded,true);
 assert.equal(proof.combinedSummary.year2021OfficialPrintOnlyMinutesStillMissing,true);
 assert.equal(proof.combinedSummary.year2022PrintElectronicDifferenceUnknown,true);
 assert.equal(proof.combinedSummary.privateHistoricalEvidenceRowsReconciled,false);
 assert.equal(proof.safeguards.noRawCaptionWordsOrAudioVideoBodiesStored,true);
 assert.equal(proof.safeguards.noPersonNameIndividualSidesFromAggregateOrTranscripts,true);
 assert.equal(proof.safeguards.noPrivateProductionDbAccessOrWrites,true);
 assert.equal(proof.safeguards.noModelTrainingForecastServingScheduler2027Changes,true);
 assert.equal(proof.safeguards.issue864MustRemainOpen,true);
});
