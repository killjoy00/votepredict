/**
 * Synthetic ONLY: no VotePredict private SELECT export, live Wayback or original
 * politician quotations ever fetched or fabricated as real observations.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {
  reconcileSenateMediaProofAndCoverage,
  type OfflinePublicLead,type OfflinePublicBatchReport,
} from '../evidence/senate-media-offline-proof-reconciliation.ts';
import type {
  SenateMediaContextExport,SenateMediaRosterYear,SenateMediaReview,
  SenateMediaSourceSnapshot,
} from '../evidence/senate-media-remarks-audit.ts';

const original='https://www.mprnews.org/episode/2024/02/19/'
 +'without-total-dfl-support-the-north-star-act-is-going-south';
const published='2024-02-19T10:32:00-06:00';
const capture='20240301120000';
const captureIso='2024-03-01T12:00:00Z';
const archive='https://web.archive.org/web/'+capture+'id_/'+original;
const digest='EYF556SVU3PSYJYZ3HFXUNN2IXQVS73B';
const syntheticHtml='<html><head><meta property="article:published_time" content="'
  +published+'"></head><body><p>Sen. Example said, '
  +'"Our schools need more funding."</p></body></html>';
const sha=createHash('sha256').update(syntheticHtml).digest('hex');
function lead():OfflinePublicLead{
  // The URL is a known curated one; Alice Example and all other facts are fake.
  return {
    id:'mpr-2024-hauschild-north-star-on-air-interview',
    seedId:'mpr-news-story-archive',
    publisher:'MPR News',livePageUrl:original,
    publicationDayDisplayedOnPublicPage:'2024-02-19',
    namedSenatorLeadsForManualReview:['Alice Example'],
  };
}
function context():SenateMediaContextExport{
  return {
    evidenceId:'synthetic-ev1',sourceDocumentId:'synthetic-source1',
    sourceKind:'wayback_local_trade_news',sourceUrl:archive,
    sourceSha256:sha,seedId:'mpr-news-story-archive',publisher:'MPR News',
    originalUrl:original,archiveUrl:archive,archiveCapturedAt:captureIso,
    archiveDigest:digest,publisherPublishedAt:published,
    evidencePublishedAt:captureIso,evidenceKind:'context',stance:'neutral',
    contextOnly:true,sameDayEligible:false,modelWeight:0,
    articleInfersLegislativeStance:false,mentionedMembers:['Alice Example'],
  };
}
function member():SenateMediaRosterYear{
  return {
    membershipId:'synthetic-member-2024',senatorId:'synthetic-senator-alice',
    senatorName:'Alice Example',year:2024,
    activeFrom:'2024-01-01',activeThrough:'2024-12-31',
  };
}
function batch(status:'index_candidates'|'index_empty'|'index_failed'='index_candidates'):
  OfflinePublicBatchReport{
  return {
    version:'senate-media-public-archive-batch-v1',
    leads:[{
      leadId:lead().id,publisher:'MPR News',originalUrl:original,
      indexStatus:status,
      replayAttempts:status==='index_candidates'?[{
        archiveUrl:archive,captureUtc:captureIso,indexedCdxSha1Base32:digest,
        status:'matched_indexed_payload_sha1',observedRawBodySha256:sha,
        matchedIndexedPayload:true,
      }]:[],
    }],
  };
}
function review():SenateMediaReview{
  return {
    sourceDocumentId:'synthetic-source1',disposition:'exact_named_quote',
    membershipId:member().membershipId,issueCategory:'education',
    exactQuote:'Our schools need more funding.',
    attributionCue:'Sen. Example said',
    sourcePassage:'Sen. Example said, "Our schools need more funding."',
    publisherPublishedAt:published,
    publicationDateProof:'content="'+published+'"',
    reviewedBy:'synthetic-fixture-reviewer',
    reviewedAt:'2026-10-10T23:00:00Z',
  };
}
function snapshot():SenateMediaSourceSnapshot{
  return {sourceDocumentId:'synthetic-source1',
    rawBodyBase64:Buffer.from(syntheticHtml).toString('base64')};
}
function run(extra:{
  leads?:OfflinePublicLead[];
  batch?:OfflinePublicBatchReport|null;
  contexts?:SenateMediaContextExport[];
  roster?:SenateMediaRosterYear[];
  reviews?:SenateMediaReview[];
  snapshots?:SenateMediaSourceSnapshot[];
}={}){
  return reconcileSenateMediaProofAndCoverage({
    publicLedger:extra.leads??[lead()],
    publicBatch:extra.batch===undefined?batch():extra.batch,
    contexts:extra.contexts??[context()],roster:extra.roster??[member()],
    reviews:extra.reviews??[],snapshots:extra.snapshots??[],
  });
}

test('exact public CDX replay metadata plus private source identity creates ONLY crosswalk, never quote or eligibility',()=>{
  const r=run();
  assert.equal(r.checkedInPublicLeadUrls,1);
  assert.equal(r.suppliedPublicBatchUrlRows,1);
  assert.equal(r.publicReplayToPrivateStoredSourceMetadataMatches,1);
  assert.equal(r.humanVerifiedNamedQuotePassagesInPrivateAudit,0);
  assert.equal(r.humanVerifiedNamedQuotePassagesAlsoInPublicCrossMatchedSources,0);
  assert.equal(r.byLead[0]?.status,'public_replay_matches_private_metadata');
  assert.deepEqual(r.byLead[0]?.exactPublicReplayAndStoredPrivateSourceDocumentIds,
    ['synthetic-source1']);
  assert.equal(r.byLead[0]?.eligibilityForHistoricalPrediction,false);
  assert.equal(r.byLead[0]?.originalArchiveBytesIndependentlyReverifiedByThisOfflineTool,false);
  assert.equal(r.sourceReviewQueue.length,1);
  assert.equal(r.sourceReviewQueue[0]?.humanQuoteReviewStatus,
    'needs_original_html_and_human_speaker_review');
  assert.equal(r.sourceReviewQueue[0]?.originalHtmlBytesPresentInSuppliedPrivateSnapshots,false);
  assert.equal(r.sourceReviewQueue[0]?.originalAudioOrTranscriptPublicationTimeIndependentlyProven,false);
  assert.equal(r.policy.publicMetadataRequiresIndependentArtifactProvenanceReview,true);
  assert.equal(r.policy.noHistoricalCompletenessCertificate,true);
  assert.equal(r.policy.readsProductionDataOrCredentials,false);
});

test('human quote accepted only with independently SHA-checked original bytes, actual review, senator membership and date',()=>{
  const noBody=run({reviews:[review()]});
  assert.equal(noBody.humanVerifiedNamedQuotePassagesInPrivateAudit,0);
  const verified=run({reviews:[review()],snapshots:[snapshot()]});
  assert.equal(verified.humanVerifiedNamedQuotePassagesInPrivateAudit,1);
  assert.equal(verified.humanVerifiedNamedQuotePassagesAlsoInPublicCrossMatchedSources,1);
  assert.equal(verified.byLead[0]?.humanVerifiedQuoteCountOnCrossMatchedDocuments,1);
  assert.equal(verified.sourceReviewQueue[0]?.originalHtmlBytesPresentInSuppliedPrivateSnapshots,true);
  assert.equal(verified.sourceReviewQueue[0]?.humanQuoteReviewStatus,
    'already_human_verified_in_private_inputs');
  assert.equal(verified.bySenatorYear[0]?.verifiedNamedQuotePassagesInSuppliedPrivateAudit,1);
  assert.equal(verified.bySenatorYear[0]?.verifiedNamedQuotePassagesAlsoCrossMatchedPublicly,1);
  assert.equal(verified.bySenatorYear[0]?.historicalFullSenatorMediaUniverseCovered,false);
  assert.equal(verified.byYear[3]?.senatorYearsWithVerifiedPrivateNamedQuote,1);
  assert.equal(verified.policy.noPredictionModelOrCollectorMutation,true);
  const invalid=review();
  invalid.attributionCue='A reporter said';
  assert.equal(run({reviews:[invalid],snapshots:[snapshot()]}).humanVerifiedNamedQuotePassagesInPrivateAudit,0);
});

test('public index denial and empty first page do not become zero-original or absent-article claims',()=>{
  for(const [status,wanted]of [
    ['index_failed','public_index_unavailable_or_invalid'],
    ['index_empty','bounded_public_index_empty_not_no_article'],
  ] as const){
    const r=run({batch:batch(status)});
    assert.equal(r.byLead[0]?.status,wanted);
    assert.equal(r.byLead[0]?.matchingOriginalUrlDocumentIds.length,1);
    assert.equal(r.byLead[0]?.exactPublicReplayAndStoredPrivateSourceDocumentIds.length,0);
    assert.equal(r.byLead[0]?.allPublishedArticlesForUrlOrPublisherKnown,false);
    assert.equal(r.byPublisherYear.find(x=>x.year===2024
      &&x.publisher==='MPR News')?.unknownActualPublishedOriginalArticleCount,true);
  }
  const noProbe=run({batch:null});
  assert.equal(noProbe.byLead[0]?.status,'not_probed_in_supplied_public_batch');
  assert.equal(noProbe.suppliedPublicBatchUrlRows,0);
  assert.equal(noProbe.humanVerifiedNamedQuotePassagesInPrivateAudit,0);
});

test('different exact capture, SHA or CDX digest is not matched merely by publisher URL',()=>{
  for(const mismatch of [
    {...context(),archiveUrl:'https://web.archive.org/web/20240302120000id_/'+original,
      sourceUrl:'https://web.archive.org/web/20240302120000id_/'+original,
      archiveCapturedAt:'2024-03-02T12:00:00Z',evidencePublishedAt:'2024-03-02T12:00:00Z'},
    {...context(),sourceSha256:'0'.repeat(64)},
    {...context(),archiveDigest:'THEOTHERCDXINDEXDIGEST'},
  ]){
    const r=run({contexts:[mismatch]});
    assert.equal(r.publicReplayToPrivateStoredSourceMetadataMatches,0);
    assert.equal(r.byLead[0]?.status,'public_replay_private_archive_identity_or_hash_differs');
    assert.equal(r.sourceReviewQueue.length,0);
  }
  const empty=run({contexts:[]});
  assert.equal(empty.byLead[0]?.status,'public_replay_not_in_supplied_private_export');
  assert.equal(empty.byLead[0]?.allPublishedArticlesForUrlOrPublisherKnown,false);
});

test('same official senator ID with two district or membership rows remains ONE year, no invented statewide denominator',()=>{
  const two={...member(),membershipId:'synthetic-after-redistricting',
    activeFrom:'2024-06-01',activeThrough:'2024-12-31'};
  const r=run({roster:[member(),two],contexts:[]});
  assert.equal(r.bySenatorYear.length,1);
  assert.equal(r.bySenatorYear[0]?.membershipIds.length,2);
  assert.equal(r.byYear.find(x=>x.year===2024)?.suppliedRosterSenatorIds,1);
  assert.equal(r.bySenatorYear[0]?.curatedPublicUrlMentionsOnVerifiedServingDays,1);
  assert.equal(r.bySenatorYear[0]?.missingness,
    'bounded_export_no_verified_quote_not_no_public_remark');
  assert.equal(r.policy.countedUniqueSenatorYearsBySenatorIdNotDistrictOrMembership,true);
});

test('a public lead about an unserved or uncertain senator-date is not attributed automatically',()=>{
  const future={...member(),activeFrom:'2024-02-20'};
  const unknown={...member(),activeFrom:null,activeThrough:null};
  assert.equal(run({roster:[future],contexts:[]}).bySenatorYear[0]
    ?.curatedPublicUrlMentionsOnVerifiedServingDays,0);
  const out=run({roster:[unknown],contexts:[]}).bySenatorYear[0]!;
  assert.equal(out.curatedPublicUrlMentionsOnVerifiedServingDays,0);
  assert.equal(out.curatedPublicUrlMentionsWithUnknownTermDay,1);
  assert.equal(out.servingTermBoundsFullyKnown,false);
});

test('malformed or forged CDX report cannot create private-source proof',()=>{
  const q=batch();
  q.leads[0]!.replayAttempts[0]!.observedRawBodySha256='0'.repeat(64);
  assert.equal(run({batch:q}).publicReplayToPrivateStoredSourceMetadataMatches,0);
  const wrong=batch();wrong.leads[0]!.originalUrl='https://example.com/bad';
  assert.throws(()=>run({batch:wrong}),/Untrusted public source/);
  const fake=batch();fake.leads[0]!.replayAttempts[0]!.matchedIndexedPayload=false;
  assert.throws(()=>run({batch:fake}),/Inconsistent public replay/);
  const unindexed=batch('index_failed');
  unindexed.leads[0]!.replayAttempts=batch().leads[0]!.replayAttempts;
  assert.throws(()=>run({batch:unindexed}),/Public replay without indexed/);
  const wrongT=batch();wrongT.leads[0]!.replayAttempts[0]!.captureUtc='2024-02-19T12:00:00Z';
  assert.throws(()=>run({batch:wrongT}),/Untrusted public original-replay/);
  assert.throws(()=>run({batch:{...batch(),version:'malicious'}}),/Unsupported public archive/);
});

test('crosswalk never overstates sample as statewide or doubles possible URL aliases',()=>{
  const reformerLead:OfflinePublicLead={
    id:'mn-reformer-2024-sanctuary-brief',publisher:'Minnesota Reformer',
    seedId:'minnesota-reformer-article-archive',
    livePageUrl:'https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/',
    publicationDayDisplayedOnPublicPage:'2024-02-12',
    namedSenatorLeadsForManualReview:['Alice Example'],
  };
  const r=run({leads:[lead(),reformerLead],contexts:[],batch:null});
  assert.equal(r.checkedInPublicLeadUrls,2);
  assert.equal(r.byLead.length,2);
  assert.equal(r.bySenatorYear.length,1);
  assert.equal(r.byYear[3]?.curatedPublicUrlLeads,2);
  assert.equal(r.bySenatorYear[0]?.curatedPublicUrlMentionsOnVerifiedServingDays,2);
  assert.equal(r.bySenatorYear[0]?.historicalFullSenatorMediaUniverseCovered,false);
  assert.equal(r.byPublisherYear.find(x=>x.year===2024
    &&x.publisher==='Minnesota Reformer')?.checkedInPublisherArticleUniverseCount,null);
});
