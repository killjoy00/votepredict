import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  SENATE_MEDIA_REHYDRATION_VERSION,
  planSenateMediaRehydration,
} from '../evidence/senate-media-archive-rehydration.ts';
import type {
  SenateMediaContextExport,SenateMediaRosterYear,
} from '../evidence/senate-media-remarks-audit.ts';

const script='research/scripts/reconcile-senate-media-batches-private.ts';
const body='<html><head><title>A synthetic media source</title></head>'
  + '<body>Senator Rowan was mentioned in a synthetic test story, not quoted.</body></html>';
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
function context():SenateMediaContextExport{
  const original='https://www.mprnews.org/story/2023/04/02/synthetic-not-real';
  const archive='https://web.archive.org/web/20230404101112id_/'+original;
  return {
    evidenceId:'test-evidence',sourceDocumentId:'test-source',
    sourceKind:'wayback_local_trade_news',sourceUrl:archive,
    sourceSha256:sha(body),seedId:'mpr-news-story-archive',publisher:'MPR News',
    originalUrl:original,archiveUrl:archive,archiveCapturedAt:'2023-04-04T10:11:12Z',
    archiveDigest:'SYNTHETIC',publisherPublishedAt:null,
    evidencePublishedAt:'2023-04-04T10:11:12Z',evidenceKind:'context',stance:'neutral',
    contextOnly:true,sameDayEligible:false,modelWeight:0,
    articleInfersLegislativeStance:false,mentionedMembers:['Alex Rowan'],
  };
}
const roster:SenateMediaRosterYear={
  year:2023,membershipId:'membership-rowan',senatorId:'rowan',
  senatorName:'Alex Rowan',activeFrom:'2023-01-01',activeThrough:'2023-12-31',
};
function put(path:string,text:string){writeFileSync(path,text,{mode:0o600});}
function jsonl(x:unknown[]){return x.map(y=>JSON.stringify(y)).join('\n')+'\n';}
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'votepredict-media-aggregate-test-'));
  const c=context();
  put(join(root,'context.jsonl'),jsonl([c]));
  put(join(root,'roster.jsonl'),jsonl([roster]));
  const dir=join(root,'batch-0');
  mkdirSync(dir,{mode:0o700});
  const page=planSenateMediaRehydration([c],{limit:6});
  const attempt={
    sourceDocumentId:c.sourceDocumentId,
    status:'verified_original_bytes',
    archiveCapturedAt:c.archiveCapturedAt,publisher:c.publisher,
    fetchedAt:'2026-10-10T21:01:00.000Z',
    bytes:Buffer.byteLength(body),observedSha256:sha(body),
  };
  const queue={
    sourceDocumentId:c.sourceDocumentId,
    sourceProofDisposition:'verified_original_bytes',rawBytesAuthenticated:true,
    namedSpeakerVerified:false,issueClassified:false,exactQuotationVerified:false,
    reviewDisposition:'unreviewed',
  };
  const files:Record<string,{bytes:number;sha256:string;rows?:number}>={};
  const store=(name:string,content:string,rows?:number)=>{
    put(join(dir,name),content);
    files[name]={bytes:Buffer.byteLength(content),sha256:sha(content),
      ...(rows===undefined?{}:{rows})};
  };
  store('source-attempts.jsonl',jsonl([attempt]),1);
  store('human-review-queue.jsonl',jsonl([queue]),1);
  store('discovery-audit.json',JSON.stringify({
    corpusContextItemsInSuppliedExport:1,verifiedAttributedQuotePassages:0,
  })+'\n');
  store('authenticated-original-snapshots.jsonl',jsonl([{
    sourceDocumentId:c.sourceDocumentId,rawBodyBase64:Buffer.from(body).toString('base64'),
  }]),1);
  put(join(dir,'manifest.json'),JSON.stringify({
    version:SENATE_MEDIA_REHYDRATION_VERSION,
    selection:{
      requestedYear:null,offset:0,limit:6,
      eligibleDocuments:page.eligibleDocuments,
      studyYearContexts:page.studyYearContexts,
      excludedOutside2021To2025:page.excludedOutside2021To2025,
      rejectedInvalidProvenance:page.rejectedInStudy,
      rejectionReasons:page.rejectionReasons,
      nextOffset:page.nextOffset,
    },
    attempted:1,verifiedSourceBodies:1,statuses:{verified_original_bytes:1},
    files,
  },null,2)+'\n');
  return {root,dir};
}
function run(root:string,dir?:string){
  const args=['--import','tsx',script,
    '--context',join(root,'context.jsonl'),'--roster',join(root,'roster.jsonl')];
  if(dir)args.push('--batch-dir',dir);
  args.push('--output-dir',join(root,dir?'out-with-batch':'out-without-batch'));
  return spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000,maxBuffer:40000});
}
test('offline private CLI authenticates manifest file hashes and emits review-only combined source bytes',()=>{
  const {root,dir}=fixture();
  try {
    const result=run(root,dir);
    assert.equal(result.status,0,result.stderr.slice(0,500));
    const out=join(root,'out-with-batch');
    const summary=JSON.parse(readFileSync(join(out,'source-retrieval-coverage.json'),'utf8'));
    assert.equal(summary.eligibleDistinctArchivedArticles,1);
    assert.equal(summary.attemptedDistinctSources,1);
    assert.equal(summary.exactOriginalHashMatched,1);
    assert.equal(summary.byPublisherCaptureYear.length,220);
    assert.equal(summary.auditVerifiedQuotePassages,0);
    const matched=JSON.parse(readFileSync(join(out,'authenticated-original-snapshots.jsonl'),'utf8'));
    assert.equal(Buffer.from(matched.rawBodyBase64,'base64').toString('utf8'),body);
    assert.ok(existsSync(join(out,'manifest.json')));
    assert.doesNotMatch(result.stdout,/senator\s+rowan|mprnews\.org/i);
    assert.doesNotMatch(result.stderr,/senator\s+rowan|mprnews\.org/i);
  } finally{rmSync(root,{recursive:true,force:true});}
});
test('tampered private manifest source body fails before writing any aggregate output',()=>{
  const {root,dir}=fixture();
  try {
    put(join(dir,'source-attempts.jsonl'),'{ "tampered": true }\n');
    const result=run(root,dir);
    assert.notEqual(result.status,0);
    assert.equal(existsSync(join(root,'out-with-batch')),false);
    assert.doesNotMatch(result.stdout+result.stderr,/mprnews\.org|synthetic-not-real|Alex Rowan/i);
  } finally{rmSync(root,{recursive:true,force:true});}
});
test('zero input batches are a valid baseline and leave a private missingness report, not a quote claim',()=>{
  const {root}=fixture();
  try {
    const result=run(root);
    assert.equal(result.status,0,result.stderr.slice(0,500));
    const out=join(root,'out-without-batch');
    const summary=JSON.parse(readFileSync(join(out,'source-retrieval-coverage.json'),'utf8'));
    assert.equal(summary.attemptedDistinctSources,0);
    assert.equal(summary.notAttempted,1);
    assert.equal(summary.auditVerifiedQuotePassages,0);
    assert.equal(existsSync(join(out,'authenticated-original-snapshots.jsonl')),false);
  } finally{rmSync(root,{recursive:true,force:true});}
});
