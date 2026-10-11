/** #987: immutable ORIGINAL 2023 Rest reporter quote archived source metadata. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const dir='docs/evaluation/';
const d=JSON.parse(readFileSync(
  dir+'senate-media-rest-2023-exact-public-historical-html-quote-receipts-20261011.json','utf8',
));
const prior=JSON.parse(readFileSync(
  dir+'senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json','utf8',
));
const queue=JSON.parse(readFileSync(
  dir+'senate-media-2023-rest-historical-original-quote-fragment-queue.json','utf8',
));

test('source exact 2023 Rest quote audit ZIP and decoded 4,201-byte JSON are permanently identified',()=>{
  assert.equal(d.version,'senate-media-rest-2023-exact-public-historical-html-quote-receipts-v1');
  assert.equal(d.reviewedOn,'2026-10-11');
  assert.equal(d.individualSenator,'Ann Rest');
  assert.equal(d.officialService,'https://www.lrl.mn.gov/legdb/fulldetail?ID=10558');
  assert.equal(d.originalIndependentReporter,'Michelle Griffith');
  assert.equal(d.originalPublisher,'Minnesota Reformer');
  assert.equal(d.sourceUrl,'https://minnesotareformer.com/2023/04/26/here-are-some-of-the-differences-between-the-senate-and-house-dfl-tax-plans/');
  const r=d.publicSourceAuditRun;
  assert.equal(r.runId,38160243938);
  assert.equal(r.result,'success');
  assert.equal(r.exactSourceHeadSha,'720a7a64adab85cd8e72142519c396b7e079bab9');
  assert.equal(r.artifactId,11709863945);
  assert.equal(r.artifactName,'senate-media-rest-2023-original-phrase-proof');
  assert.equal(r.originalDownloadedZipSha256,
    '8c748013214c2175622ed2378463ebac799fd5292a79a07822fa5082bca94435');
  assert.equal(r.decodedExactOriginalJsonSha256,
    'c7a0241699b20e2265ad49929448e3f28b02ab104b8b2423cdeedbaada31be44');
  assert.equal(r.decodedExactOriginalJsonBytes,4201);
});

test('all four short historic markup fragments found with Rest same-paragraph attribution ONLY after exact SHA1+SHA256',()=>{
  assert.deepEqual(d.resultCounts,{
    originalArchivedHttpBodiesRequested:2,
    originalHttpBodySha1AndSha256BothReverified:2,
    unverifiedOriginalHttpBodies:0,shortPhraseHtmlChecks:4,
    phraseFoundInHistoricalHtml:4,phraseNotFoundInHistoricalHtml:0,
    phraseUnknownDueToOriginalUnavailable:0,
    sameParagraphNamedSpeakerLabelCues:4,originalRecordedAudioCompared:0,
    individualHistoricalSenatorQuotationHumanApproved:0,
    actualRecordedVotesVerified:0,originalPublisherFirstPostingClocksAuthenticated:0,
  });
  assert.equal(d.originalVersionSpecificShortPhraseProofs.length,2);
  const known=prior.pinnedExactSha1AndRawSha256OriginalCaptureReceipts.find(
    (x:{leadId:string})=>x.leadId==='public-2023-rest-tax-reformer');
  assert.ok(known);
  for(const row of d.originalVersionSpecificShortPhraseProofs){
    assert.equal(row.archiveStatus,'original_exact_sha_verified');
    const original=known.verifiedOriginalHttpBodies.find(
      (x:{captureUtc:string})=>x.captureUtc===row.captureUtc);
    assert.ok(original);
    assert.equal(row.reverifiedOriginalSha256,original.rawOriginalSha256);
    assert.equal(row.reverifiedOriginalBytes,original.originalBytes);
    assert.deepEqual(row.cues.map((x:{cueId:string})=>x.cueId),
      queue.cues.map((x:{id:string})=>x.id));
    assert.ok(row.cues.every((x:{
      historicalHtmlShortFragmentFound:boolean;sameHtmlParagraphContainsRestSpeakerLabel:boolean;
    })=>x.historicalHtmlShortFragmentFound
      &&x.sameHtmlParagraphContainsRestSpeakerLabel));
    assert.equal(row.cues[1]?.sourceStatementIsAboutExpectedFutureCaucusVotesNotObservedRollCall,true);
  }
  assert.deepEqual(d.originalVersionSpecificShortPhraseProofs.map(
    (x:{captureUtc:string})=>x.captureUtc),
    ['2023-04-27T00:52:03Z','2023-12-03T13:07:09Z']);
});

test('reported Rest position never becomes actual Senate votes, audio, human quote approval or publication clock',()=>{
  const meanings=d.strictMeaning;
  for(const [key,value] of Object.entries(meanings))
    assert.equal(value,true,'Original Rest quote evidence guard: '+key);
  assert.equal(d.resultCounts.actualRecordedVotesVerified,0);
  assert.equal(d.resultCounts.individualHistoricalSenatorQuotationHumanApproved,0);
  assert.equal(d.resultCounts.originalRecordedAudioCompared,0);
  assert.equal(d.resultCounts.originalPublisherFirstPostingClocksAuthenticated,0);
  assert.equal(Object.hasOwn(d,'entireOriginalReporterArticleHtml'),false);
  assert.equal(Object.hasOwn(d,'originalQuotedAudio'),false);
  assert.equal(Object.hasOwn(d,'privateVotePredictSourceDocumentIds'),false);
});
