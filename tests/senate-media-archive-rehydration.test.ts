import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  auditSenateMediaRemarks,
  type SenateMediaContextExport,
  type SenateMediaRosterYear,
} from '../src/evidence/senate-media-remarks-audit.js';
import {
  SENATE_MEDIA_MAX_ORIGINAL_BYTES,
  fetchSenateMediaOriginalBytes,
  planSenateMediaRehydration,
  type SenateMediaSnapshotCandidate,
} from '../src/evidence/senate-media-archive-rehydration.js';

const body = '<html><head><meta property="article:published_time" content="2023-04-02T12:00:00Z"></head>'
  + '<body><p>Sen. Example said, "We must support public schools."</p></body></html>';
const original = 'https://www.mprnews.org/story/2023/04/02/education';
const digest=(value: Uint8Array | string)=>
  createHash('sha256').update(value).digest('hex');

function context(ts='20230404101112', index='1'): SenateMediaContextExport {
  const date=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)+'T'
    +ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
  const url='https://web.archive.org/web/'+ts+'id_/'+original;
  return {
    evidenceId:'ev-'+index,sourceDocumentId:'source-'+index,
    sourceKind:'wayback_local_trade_news',
    sourceUrl:url,sourceSha256:digest(body),
    seedId:'mpr-news-story-archive',publisher:'MPR News',
    originalUrl:original,archiveUrl:url,archiveCapturedAt:date,
    archiveDigest:'CDXDIGESTTEST',publisherPublishedAt:'2023-04-02T12:00:00Z',
    evidencePublishedAt:date,evidenceKind:'context',stance:'neutral',
    contextOnly:true,sameDayEligible:false,modelWeight:0,
    articleInfersLegislativeStance:false,
    mentionedMembers:['Alice Example'],
  };
}
const senator: SenateMediaRosterYear={
  year:2023,membershipId:'m-2023',senatorId:'alice',senatorName:'Alice Example',
  activeFrom:'2023-01-01',activeThrough:'2023-12-31',
};
function candidate(row=context()): SenateMediaSnapshotCandidate {
  const plan=planSenateMediaRehydration([row]);
  assert.equal(plan.selected.length,1);
  return plan.selected[0]!;
}
function fetchWithResponse(response: Response, onCall?: (url: string,init: RequestInit) => void): typeof fetch {
  return (async (url: string | URL | Request,init?: RequestInit) => {
    onCall?.(String(url),init??{});
    return response;
  }) as typeof fetch;
}

test('plan isolates eligible 2021–2025 archived context from 2026 and never equates mentions with quotes',()=>{
  const c2021=context('20210404101112','a');
  c2021.publisherPublishedAt=null;
  const c2025=context('20250404101112','b');
  c2025.publisherPublishedAt=null;
  const c2026=context('20260404101112','c');
  c2026.publisherPublishedAt=null;
  const plan=planSenateMediaRehydration([c2021,c2026,c2025],{limit:1});
  assert.equal(plan.studyYearContexts,2);
  assert.equal(plan.excludedOutside2021To2025,1);
  assert.equal(plan.eligibleDocuments,2);
  assert.equal(plan.selected[0]?.captureYear,2021);
  assert.equal(plan.nextOffset,1);
  assert.equal(plan.safeToDeclareHistoricalCompleteness,false);
  const next=planSenateMediaRehydration([c2021,c2026,c2025],{limit:1,offset:1});
  assert.equal(next.selected[0]?.captureYear,2025);
  assert.equal(next.nextOffset,null);
  assert.equal(planSenateMediaRehydration([c2021,c2026,c2025],{year:2025}).eligibleDocuments,1);
});

test('untrusted context metadata excluded with explicit recorded problems; no speculative archival fetch',()=>{
  const bad=context();
  bad.contextOnly=false;
  bad.modelWeight=1;
  const plan=planSenateMediaRehydration([bad]);
  assert.equal(plan.selected.length,0);
  assert.equal(plan.rejectedInStudy,1);
  assert.equal(plan.rejectionReasons.not_neutral_archived_context,1);
});

test('spoofed archive host, differing original path, wrong timestamp, or no sha are rejected',()=>{
  const rows=[context('20230404101112','1'),context('20230404101112','2'),
    context('20230404101112','3'),context('20230404101112','4')];
  rows[0]!.archiveUrl=rows[0]!.archiveUrl!.replace('web.archive.org','web.archive.org.evil.test');
  rows[0]!.sourceUrl=rows[0]!.archiveUrl!;
  rows[1]!.archiveUrl=rows[1]!.archiveUrl!.replace('/education','/different');
  rows[1]!.sourceUrl=rows[1]!.archiveUrl!;
  rows[2]!.archiveCapturedAt='2023-04-05T10:11:12Z';
  rows[3]!.sourceSha256='not-a-hash';
  const plan=planSenateMediaRehydration(rows);
  assert.equal(plan.rejectedInStudy,4);
  assert.equal(plan.selected.length,0);
  assert.equal(plan.rejectionReasons.unsafe_or_noncanonical_original_archive_url,3);
  assert.equal(plan.rejectionReasons.missing_valid_original_sha256,1);
});

test('duplicate evidence identities and conflicting per-document source identity fail hard',()=>{
  const c=context();
  assert.throws(()=>planSenateMediaRehydration([c,c]),/Duplicate or missing/);
  const copy={...context('20230405101112','2'),sourceDocumentId:c.sourceDocumentId};
  assert.throws(()=>planSenateMediaRehydration([c,copy]),/Conflicting original/);
});

test('batch controls cap at twelve and reject 2026, huge offsets and noninteger limits',()=>{
  assert.throws(()=>planSenateMediaRehydration([context()],{limit:13}),/between 1 and 12/);
  assert.throws(()=>planSenateMediaRehydration([context()],{limit:0}),/between 1 and 12/);
  assert.throws(()=>planSenateMediaRehydration([context()],{year:2026}),/2021–2025/);
  assert.throws(()=>planSenateMediaRehydration([context()],{offset:-1}),/between 0/);
  assert.throws(()=>planSenateMediaRehydration([context()],{offset:0.2}),/between 0/);
});

test('real original byte SHA match yields auditor-compatible snapshot without any automatic quote certification',async()=>{
  let requests=0;
  const response=new Response(body,{status:200,headers:{'content-type':'text/html'}});
  const result=await fetchSenateMediaOriginalBytes(candidate(),fetchWithResponse(response,(url,opts)=>{
    requests++;
    assert.equal(url,context().archiveUrl);
    assert.equal(opts.redirect,'manual');
    assert.equal(opts.method,'GET');
  }));
  assert.equal(requests,1);
  assert.equal(result.status,'verified_original_bytes');
  assert.equal(result.bytes,Buffer.byteLength(body));
  assert.equal(result.observedSha256,digest(body));
  assert.deepEqual(result.snapshot,{
    sourceDocumentId:'source-1',rawBodyBase64:Buffer.from(body).toString('base64')
  });
  const audit=auditSenateMediaRemarks({
    contexts:[context()],roster:[senator],reviews:[],snapshots:[result.snapshot!],
  });
  assert.equal(audit.verifiedAttributedQuotePassages,0);
  assert.equal(audit.unreviewedArchivedArticles,1);
  assert.equal(audit.byPublisherYear.find(x=>x.year===2023
    && x.seedId==='mpr-news-story-archive')?.originalSnapshotsSupplied,1);
});

test('original raw bytes, not decoded UTF-8 reserialization, are authenticated',async()=>{
  const bytes=Buffer.concat([Buffer.from(body),Buffer.from([0xff,0xfe])]);
  const c=context(); c.sourceSha256=digest(bytes);
  const result=await fetchSenateMediaOriginalBytes(candidate(c),
    fetchWithResponse(new Response(bytes,{status:200,headers:{'content-type':'text/html'}})));
  assert.equal(result.status,'verified_original_bytes');
  assert.equal(result.snapshot?.rawBodyBase64,bytes.toString('base64'));
});

test('changed Wayback content fails original hash and does not save a plausible new article',async()=>{
  const modified=body.replace('public schools','transportation');
  const result=await fetchSenateMediaOriginalBytes(candidate(),
    fetchWithResponse(new Response(modified,{headers:{'content-type':'text/html'}})));
  assert.equal(result.status,'original_bytes_hash_mismatch');
  assert.equal(result.observedSha256,digest(modified));
  assert.equal(result.snapshot,undefined);
});

test('Wayback redirect is refused even when Location resembles archived URL',async()=>{
  const result=await fetchSenateMediaOriginalBytes(candidate(),fetchWithResponse(
    new Response(null,{status:302,headers:{location:context().archiveUrl!}})
  ));
  assert.equal(result.status,'redirect_refused');
  assert.equal(result.snapshot,undefined);
});

test('HTTP, non-article MIME, oversized declared and read streamed bodies fail closed',async()=>{
  const c=candidate();
  const notFound=await fetchSenateMediaOriginalBytes(c,fetchWithResponse(
    new Response('not found',{status:404,headers:{'content-type':'text/html'}})
  ));
  assert.equal(notFound.status,'http_not_200');
  const fakePdf=await fetchSenateMediaOriginalBytes(c,fetchWithResponse(
    new Response(body,{headers:{'content-type':'application/pdf'}})
  ));
  assert.equal(fakePdf.status,'non_article_content_type');
  const oversized=await fetchSenateMediaOriginalBytes(c,fetchWithResponse(
    new Response(body,{headers:{
      'content-type':'text/html','content-length':String(SENATE_MEDIA_MAX_ORIGINAL_BYTES+1)
    }})
  ));
  assert.equal(oversized.status,'body_size_limit');
  const streamBytes=new Uint8Array(SENATE_MEDIA_MAX_ORIGINAL_BYTES+1);
  const streamed=await fetchSenateMediaOriginalBytes(c,fetchWithResponse(
    new Response(streamBytes,{headers:{'content-type':'text/html'}})
  ));
  assert.equal(streamed.status,'body_size_limit');
  assert.equal(streamed.snapshot,undefined);
});

test('short article, network failure and noncanonical direct fetch fail closed',async()=>{
  const short=await fetchSenateMediaOriginalBytes(candidate(),fetchWithResponse(
    new Response('x',{headers:{'content-type':'text/html'}})
  ));
  assert.equal(short.status,'empty_or_short_body');
  const network=await fetchSenateMediaOriginalBytes(candidate(),
    (async()=>{throw Error('network unavailable');}) as typeof fetch);
  assert.equal(network.status,'fetch_failed');
  let called=false;
  const invalid={...candidate(),archiveUrl:'https://web.archive.org.evil.test/steal'};
  const rejected=await fetchSenateMediaOriginalBytes(invalid,(async()=>{
    called=true;throw Error('never request');
  }) as typeof fetch);
  assert.equal(rejected.status,'untrusted_archive_location');
  assert.equal(called,false);
});
