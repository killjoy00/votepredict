import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  reconcileSenateMediaPrivateBatches,
  type PrivateMediaBatchManifest,
  type SenateMediaPrivateBatch,
} from '../evidence/senate-media-batch-reconciliation.ts';
import {
  SENATE_MEDIA_REHYDRATION_VERSION,
  planSenateMediaRehydration,
  type MediaArchiveFetchResult,
  type MediaArchiveFetchStatus,
} from '../evidence/senate-media-archive-rehydration.ts';
import type {
  SenateMediaContextExport, SenateMediaRosterYear, SenateMediaSourceSnapshot,
} from '../evidence/senate-media-remarks-audit.ts';

const body='<html><head><meta property="article:published_time" content="2023-04-02T12:00:00Z"></head>'
  + '<body>Senator Rowan arrived at the Capitol today and discussed the news story.</body></html>';
const hash=(bytes: string|Uint8Array)=>
  createHash('sha256').update(bytes).digest('hex');

function context(id:string,ts='20230404101112'):SenateMediaContextExport{
  const captured=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)+'T'
    +ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
  const original='https://www.mprnews.org/story/'+ts.slice(0,4)+'/01/01/senate-news-'+id;
  const archive='https://web.archive.org/web/'+ts+'id_/'+original;
  return {
    evidenceId:'evidence-'+id,sourceDocumentId:'source-'+id,
    sourceKind:'wayback_local_trade_news',sourceUrl:archive,sourceSha256:hash(body),
    seedId:'mpr-news-story-archive',publisher:'MPR News',
    originalUrl:original,archiveUrl:archive,archiveCapturedAt:captured,
    archiveDigest:'DIGEST',publisherPublishedAt:null,evidencePublishedAt:captured,
    evidenceKind:'context',stance:'neutral',contextOnly:true,sameDayEligible:false,
    modelWeight:0,articleInfersLegislativeStance:false,
    mentionedMembers:['Senator Rowan'],
  };
}
const roster:SenateMediaRosterYear[]=[
  {year:2023,membershipId:'membership-23',senatorId:'rowan',senatorName:'Alex Rowan',
    activeFrom:'2023-01-01',activeThrough:'2023-12-31'},
  {year:2025,membershipId:'membership-25',senatorId:'rowan',senatorName:'Alex Rowan',
    activeFrom:'2025-01-01',activeThrough:'2025-12-31'},
];
function successfulSnapshot(sourceDocumentId:string):SenateMediaSourceSnapshot{
  return {sourceDocumentId,rawBodyBase64:Buffer.from(body).toString('base64')};
}
type Receipt=Omit<MediaArchiveFetchResult,'snapshot'>;
function batch(
  contexts:SenateMediaContextExport[],
  options:{offset?:number;limit?:number;year?:number;statuses?:MediaArchiveFetchStatus[]}={},
):SenateMediaPrivateBatch {
  const page=planSenateMediaRehydration(contexts,{
    ...(options.year===undefined?{}:{year:options.year}),
    offset:options.offset??0,limit:options.limit??12,
  });
  const receipts:Receipt[]=page.selected.map((source,i)=>{
    const status=options.statuses?.[i]??'verified_original_bytes';
    const mismatch=status==='original_bytes_hash_mismatch';
    return {
      sourceDocumentId:source.sourceDocumentId,
      archiveCapturedAt:source.archiveCapturedAt,publisher:source.publisher,
      fetchedAt:'2026-10-10T20:45:00.000Z',
      status,
      bytes:status==='verified_original_bytes'?Buffer.byteLength(body)
        :mismatch?Buffer.byteLength(body)+1:null,
      observedSha256:status==='verified_original_bytes'?hash(body)
        :mismatch?hash(body+'X'):null,
    };
  });
  const snapshots=receipts.filter(row=>row.status==='verified_original_bytes')
    .map(row=>successfulSnapshot(row.sourceDocumentId));
  const statuses:Record<string,number>={};
  for(const row of receipts) statuses[row.status]=(statuses[row.status]??0)+1;
  const manifest:PrivateMediaBatchManifest={
    version:SENATE_MEDIA_REHYDRATION_VERSION,
    selection:{
      requestedYear:options.year??null,
      offset:options.offset??0,limit:options.limit??12,
      eligibleDocuments:page.eligibleDocuments,
      studyYearContexts:page.studyYearContexts,
      excludedOutside2021To2025:page.excludedOutside2021To2025,
      rejectedInvalidProvenance:page.rejectedInStudy,
      rejectionReasons:page.rejectionReasons,
      nextOffset:page.nextOffset,
    },
    attempted:receipts.length, verifiedSourceBodies:snapshots.length,
    statuses,files:{},
  };
  return {manifest,attempts:receipts,snapshots};
}

test('zero private retrieval batches represent missing attempts, NOT zero published articles',()=>{
  const contexts=[context('a'),context('b','20250404101112'),context('old','20260404101112')];
  const result=reconcileSenateMediaPrivateBatches({contexts,roster,batches:[]});
  assert.equal(result.summary.eligibleDistinctArchivedArticles,2);
  assert.equal(result.summary.byPublisherCaptureYear.length,220);
  assert.equal(result.summary.byPublisherCaptureYear.find(x=>x.year===2021 && x.publisher==='MPR News')?.missingness,
    'not_observed_in_export_not_no_published_articles');
  assert.equal(result.summary.outsideStudyYearContextRows,1);
  assert.equal(result.summary.attemptedDistinctSources,0);
  assert.equal(result.summary.notAttempted,2);
  assert.equal(result.summary.retrievalAttemptsCompleteForEligibleExport,false);
  assert.equal(result.summary.auditVerifiedQuotePassages,0);
  assert.equal(result.summary.statewideMediaArticleDenominatorKnown,false);
  assert.equal(result.summary.retrospectiveSourceCompletenessProven,false);
  assert.equal(result.authenticatedSnapshots.length,0);
  assert.deepEqual(result.summary.byCaptureYear.find(r=>r.year===2025)?.notAttempted,1);
});

test('batch manifest distinguishes four context rows from two original source documents',()=>{
  const shared=context('a');
  const repeat={...shared,evidenceId:'evidence-a-second',
    mentionedMembers:['Senator Rowan','Senator Second']};
  const out=context('old','20260404101112');
  const outRepeat={...out,evidenceId:'evidence-old-second'};
  const contexts=[shared,out,repeat,outRepeat];
  const planned=planSenateMediaRehydration(contexts);
  assert.equal(planned.studyYearContexts,2);
  assert.equal(planned.excludedOutside2021To2025,2);
  assert.equal(planned.eligibleDocuments,1);
  assert.deepEqual(planned.selected[0]?.mentionedMembers,
    ['Senator Rowan','Senator Second']);
  const original=batch(contexts,{limit:1});
  assert.equal(original.manifest.selection.studyYearContexts,2);
  assert.equal(original.manifest.selection.excludedOutside2021To2025,2);
  assert.equal(original.attempts.length,1);
  const result=reconcileSenateMediaPrivateBatches({
    contexts,roster,batches:[original],
  });
  assert.equal(result.summary.suppliedContextRows,4);
  assert.equal(result.summary.outsideStudyYearContextRows,2);
  assert.equal(result.summary.studyYearDistinctSourceRows,1);
  assert.equal(result.summary.eligibleDistinctArchivedArticles,1);
  assert.equal(result.summary.attemptedDistinctSources,1);
  assert.equal(result.summary.exactOriginalHashMatched,1);
  assert.equal(result.summary.auditVerifiedQuotePassages,0);
  assert.equal(result.summary.statewideMediaArticleDenominatorKnown,false);
});

test('complete multiple batches yield exact source hashes but do not certify senator remarks',()=>{
  const contexts=[context('b','20250404101112'),context('a'),context('old','20260404101112')];
  const one=batch(contexts,{offset:0,limit:1});
  const two=batch(contexts,{offset:1,limit:1,statuses:['original_bytes_hash_mismatch']});
  const result=reconcileSenateMediaPrivateBatches({contexts,roster,batches:[one,two]});
  assert.equal(result.summary.eligibleDistinctArchivedArticles,2);
  assert.equal(result.summary.attemptedDistinctSources,2);
  assert.equal(result.summary.exactOriginalHashMatched,1);
  assert.equal(result.summary.originalHashMismatched,1);
  assert.equal(result.summary.attemptedButUnavailableOrRejected,0);
  assert.equal(result.summary.notAttempted,0);
  assert.equal(result.summary.retrievalAttemptsCompleteForEligibleExport,true);
  assert.equal(result.authenticatedSnapshots.length,1);
  assert.equal(result.authenticatedSnapshots[0]?.sourceDocumentId,'source-a');
  assert.equal(result.summary.byPublisherCaptureYear.find(r=>r.year===2023 && r.seedId==='mpr-news-story-archive')?.exactOriginalHashMatched,1);
  assert.equal(result.summary.byPublisherCaptureYear.find(r=>r.year===2025 && r.seedId==='mpr-news-story-archive')?.originalHashMismatched,1);
  assert.equal(result.summary.auditVerifiedQuotePassages,0);
  assert.equal(result.summary.quotesHumanReviewed,false);
  assert.equal(result.summary.productionDatabaseReadOrWritten,false);
});

test('year-pinned batch and skipped publisher-year are disclosed as separate missingness',()=>{
  const contexts=[context('a'),context('b','20250404101112')];
  const only2025=batch(contexts,{year:2025,limit:1,offset:0,statuses:['fetch_failed']});
  const result=reconcileSenateMediaPrivateBatches({contexts,roster,batches:[only2025]});
  assert.equal(result.summary.attemptedDistinctSources,1);
  assert.equal(result.summary.attemptedButUnavailableOrRejected,1);
  assert.equal(result.summary.exactOriginalHashMatched,0);
  assert.equal(result.summary.notAttempted,1);
  assert.equal(result.summary.byCaptureYear.find(r=>r.year===2025)?.unavailableOrRejected,1);
  assert.equal(result.summary.byCaptureYear.find(r=>r.year===2023)?.notAttempted,1);
});

test('malformed or conflicting evidence identity fails before validating any alleged successes',()=>{
  const contexts=[context('a')];
  assert.throws(()=>reconcileSenateMediaPrivateBatches({
    contexts:[...contexts,...contexts],roster,batches:[],
  }),/duplicate/i);
  const contradiction={...context('b'),sourceDocumentId:'source-a',sourceSha256:'0'.repeat(64)};
  assert.throws(()=>reconcileSenateMediaPrivateBatches({
    contexts:[context('a'),contradiction],roster,batches:[],
  }),/Conflicting (?:source identities|original archived source identity)/);
});

test('overlapping and duplicated private source batches are rejected, even if hashes match',()=>{
  const contexts=[context('a'),context('b','20250404101112')];
  const first=batch(contexts,{limit:1});
  assert.throws(()=>reconcileSenateMediaPrivateBatches({
    contexts,roster,batches:[first,first],
  }),/Overlapping private media batches/);
  const wrong=batch(contexts,{limit:2});
  wrong.attempts[1]={...wrong.attempts[1]!,sourceDocumentId:wrong.attempts[0]!.sourceDocumentId};
  assert.throws(()=>reconcileSenateMediaPrivateBatches({
    contexts,roster,batches:[wrong],
  }),/does not match requested original archive/);
});

test('corrupt pagination, provenance counts, unsupported study year and reported counters fail',()=>{
  const contexts=[context('a'),context('b','20250404101112')];
  const good=batch(contexts,{limit:1});
  const mutate=[
    (b:SenateMediaPrivateBatch)=>{b.manifest.selection.eligibleDocuments=900;},
    (b:SenateMediaPrivateBatch)=>{b.manifest.selection.nextOffset=null;},
    (b:SenateMediaPrivateBatch)=>{b.manifest.selection.rejectedInvalidProvenance=4;},
    (b:SenateMediaPrivateBatch)=>{b.manifest.attempted=12;},
    (b:SenateMediaPrivateBatch)=>{b.manifest.verifiedSourceBodies=0;},
    (b:SenateMediaPrivateBatch)=>{b.manifest.statuses={'verified_original_bytes':3};},
    (b:SenateMediaPrivateBatch)=>{b.manifest.selection.requestedYear=2026;},
  ];
  for(const edit of mutate){
    const candidate=structuredClone(good);
    edit(candidate);
    assert.throws(()=>reconcileSenateMediaPrivateBatches({
      contexts,roster,batches:[candidate],
    }));
  }
});

test('source receipt authenticity requires source-document SHA, byte length and exact content',()=>{
  const contexts=[context('a')];
  const mutations=[
    (b:SenateMediaPrivateBatch)=>{b.snapshots[0]!.rawBodyBase64=Buffer.from(body+'DIFFERENT').toString('base64');},
    (b:SenateMediaPrivateBatch)=>{b.snapshots[0]!.rawBodyBase64='%%%';},
    (b:SenateMediaPrivateBatch)=>{b.snapshots[0]!.sourceDocumentId='different-source';},
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.bytes=4;},
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.observedSha256='0'.repeat(64);},
    (b:SenateMediaPrivateBatch)=>{b.snapshots=[];},
  ];
  for(const edit of mutations){
    const candidate=structuredClone(batch(contexts));
    edit(candidate);
    assert.throws(()=>reconcileSenateMediaPrivateBatches({
      contexts,roster,batches:[candidate],
    }));
  }
});

test('hash-mismatch receipt may not attach an authenticated original snapshot',()=>{
  const contexts=[context('a')];
  const failed=batch(contexts,{statuses:['original_bytes_hash_mismatch']});
  failed.snapshots=[successfulSnapshot('source-a')];
  failed.manifest.verifiedSourceBodies=1;
  assert.throws(()=>reconcileSenateMediaPrivateBatches({contexts,roster,batches:[failed]}));
});

test('unavailable attempt may not claim original bytes, source hash or a fraudulent fetchedAt',()=>{
  const contexts=[context('a')];
  const failed=batch(contexts,{statuses:['fetch_failed']});
  const tampered=[
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.bytes=99;},
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.observedSha256=hash(body);},
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.fetchedAt='2026-10-10';},
    (b:SenateMediaPrivateBatch)=>{b.attempts[0]!.status='unknown_status' as MediaArchiveFetchStatus;},
  ];
  for(const change of tampered){
    const sample=structuredClone(failed);
    change(sample);
    assert.throws(()=>reconcileSenateMediaPrivateBatches({
      contexts,roster,batches:[sample],
    }));
  }
});

test('non-neutral or invalid source provenance is visible, never silently marked retrieved',()=>{
  const valid=context('good');
  const invalid=context('bad','20250404101112');
  invalid.contextOnly=false;
  const contexts=[valid,invalid];
  const result=reconcileSenateMediaPrivateBatches({
    contexts,roster,batches:[batch(contexts,{limit:12})],
  });
  assert.equal(result.summary.invalidProvenanceStudyYearDistinctSources,1);
  assert.equal(result.summary.eligibleDistinctArchivedArticles,1);
  assert.equal(result.summary.exactOriginalHashMatched,1);
  assert.equal(result.summary.notAttempted,0);
  assert.equal(result.summary.retrospectiveSourceCompletenessProven,false);
});

test('duplicated neutral context evidence referencing identical original source is counted once',()=>{
  const a=context('a');
  const duplicate={...a,evidenceId:'evidence-a-alt'};
  const result=reconcileSenateMediaPrivateBatches({
    contexts:[a,duplicate],roster,batches:[batch([a,duplicate])],
  });
  assert.equal(result.summary.suppliedContextRows,2);
  assert.equal(result.summary.eligibleDistinctArchivedArticles,1);
  assert.equal(result.summary.attemptedDistinctSources,1);
  assert.equal(result.summary.exactOriginalHashMatched,1);
  assert.equal(result.summary.studyYearDistinctSourceRows,1);
});
