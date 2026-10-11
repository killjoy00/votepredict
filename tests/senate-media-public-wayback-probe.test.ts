/** Offline, synthetic, public-only CDX capture and original replay tests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  MEDIA_PUBLIC_CDX_INDEX_MAX_BYTES,
  MEDIA_PUBLIC_CDX_MAX_ROWS,
  MEDIA_PUBLIC_REPLAY_MAX_BYTES,
  discoverMediaPublicCdxCaptures,
  verifyMediaPublicCdxReplay,
  type PublicCdxCaptureCandidate,
  type PublicMediaResearchLead,
} from '../src/evidence/senate-media-public-wayback-probe.js';

const ledger=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8'
)) as {selectedNonExhaustiveArticleLeads:PublicMediaResearchLead[]};
const original=ledger.selectedNonExhaustiveArticleLeads.find(
  x=>x.id==='mpr-2024-hauschild-north-star-on-air-interview',
)!;
const article='<html><body>Senator Example discussed education issues. Full original historical paragraph here.</body></html>';
const sha1='2QOAWKJDBZCGZQVX36DDXMBAVMAZJGZ5';
const headers=['timestamp','original','mimetype','statuscode','digest','length'];
const cdx=(ts:string,digest=sha1,url=original.livePageUrl,mime='text/html',status='200')=>
  [ts,url,mime,status,digest,'115'];
const mock=(f:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch=>
  (async(url:string|URL|Request,init?:RequestInit)=>f(String(url),init??{})) as typeof fetch;
const indexResponse=(rows:unknown[])=>new Response(JSON.stringify([headers,...rows]),{
  headers:{'content-type':'application/json'},
});
async function candidates(rows:unknown[]):Promise<PublicCdxCaptureCandidate[]>{
  return (await discoverMediaPublicCdxCaptures(original,mock(()=>indexResponse(rows)))).captures;
}
