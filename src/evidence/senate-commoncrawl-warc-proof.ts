/**
 * #864 C: OFFLINE, fail-closed local WARC gzip range validator for a Common
 * Crawl candidate page. No network, DB, ingester or production model changes.
 *
 * This verifies consistency of an operator-provided compressed WARC range with
 * an operator-provided CDX index row. Neither source is authenticated merely
 * by supplying bytes; provenance and real historical statement still require
 * separate research/authorization.
 */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { CampaignPageLeadManifest } from './campaign-archive-source-recovery.js';
import type { CcIndexRecord } from './senate-commoncrawl-historical-recovery.js';
export const SENATE_CC_WARC_BYTE_AUDIT_VERSION='senate-commoncrawl-offline-warc-byte-check-v1' as const;
const MAX_COMPRESSED=8*1024*1024;
const MAX_UNCOMPRESSED=24*1024*1024;
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function hash(bytes:Buffer,algorithm:'sha1'|'sha256'):string{
  return createHash(algorithm).update(bytes).digest('hex');
}
function base32(bytes:Buffer):string {
  let value=0,bits=0,result='';
  for(const octet of bytes){
    value=(value<<8)|octet;
    bits+=8;
    while(bits>=5){
      result+=ALPHABET[(value>>(bits-5))&31];
      bits-=5;
    }
    value&=(1<<bits)-1;
  }
  if(bits>0)result+=ALPHABET[(value<<(5-bits))&31];
  return result;
}
function sha1B32(bytes:Buffer):string{
  return base32(createHash('sha1').update(bytes).digest());
}
function fail(message:string):never{throw new Error('Unverified Common Crawl WARC: '+message);}
function readHeaders(raw:string):{statusLine:string,fields:Map<string,string>}{
  const lines=raw.split('\r\n');
  const statusLine=lines.shift()??'';
  const fields=new Map<string,string>();
  for(const line of lines){
    if(!line||/^[ \t]/.test(line))fail('unsupported folded/header-empty line');
    const sep=line.indexOf(':');
    if(sep<=0)fail('malformed header');
    const key=line.slice(0,sep).trim().toLowerCase(),value=line.slice(sep+1).trim();
    if(!/^[a-z0-9-]+$/.test(key)||!value||fields.has(key))fail('malformed/duplicate header '+key);
    fields.set(key,value);
  }
  return {statusLine,fields};
}
function requireHeader(headers:Map<string,string>,name:string):string{
  const value=headers.get(name);
  if(!value)fail('missing '+name);
  return value;
}
function dateMs(value:string):number{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.000)?Z$/.test(value))fail('bad archived WARC-Date');
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==value.slice(0,19))
    fail('impossible archive timestamp');
  return ms;
}
function sameWebUrl(left:string,right:string):boolean{
  try{
    const a=new URL(left),b=new URL(right);
    return ['http:','https:'].includes(a.protocol)&&['http:','https:'].includes(b.protocol)
      &&a.toString()===b.toString()&&!a.username&&!a.password&&!b.username&&!b.password;
  }catch{return false;}
}
function host(url:string):string{
  try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'');}
  catch{return '';}
}
function inspectRecordLinkage(row:CcIndexRecord,leads:CampaignPageLeadManifest){
  if(leads.schema!=='mn-senate-campaign-issue-original-url-leads-2024-25-v1'
    ||leads.laterResearchSnapshot.usableAs2021to2025StatementProof!==false)
    fail('recovered page source incorrectly treated as historical proof');
  const campaign=leads.candidates.filter(c=>c.candidateName===row.candidateName
    &&c.campaignHost===row.candidateHost&&c.district===row.district
    &&c.electionYear===row.campaignElectionYear);
  if(campaign.length!==1)fail('candidate-election-domain identity mismatch');
  if(host(row.originalUrl)!==row.candidateHost)fail('wrong original website host');
  const origin=new URL(row.originalUrl);
  if(origin.username||origin.password||origin.port||!['http:','https:'].includes(origin.protocol))
    fail('disallowed original URL protocol/credentials/port');
  if(row.isKnownOriginalIssuePageUrl){
    const matched=campaign[0].pages.some(p=>!p.kind.startsWith('homepage')
      &&new URL(p.originalUrl).pathname.replace(/\/$/,'')===origin.pathname.replace(/\/$/,''));
    if(!matched)fail('claimed issue-page source path does not match pinned later-crawl page lead');
  }
}
function validateRow(row:CcIndexRecord){
  const date=dateMs(row.capturedAt);
  const general=dateMs(row.generalElectionOn+'T00:00:00Z');
  const primary=dateMs(row.primaryElectionOn+'T00:00:00Z');
  if(!(date<general)||date<Date.UTC(2024,0,1)||!['2024','2025'].includes(row.capturedAt.slice(0,4)))
    fail('post-election or out-of-scope historical response cannot be reused');
  if(row.timestamp!==row.capturedAt.replace(/[-:TZ.]/g,'').slice(0,14)
    ||row.isStrictlyBeforePrimary!==(date<primary))fail('source index date/primary timing mismatch');
  if(row.indexClaimIndependentlyAuthenticated!==false ||row.originalWarcBytesRetrieved!==false
    ||row.originalStatementTextVerified!==false ||row.forecastEligible!==false)
    fail('unverified upstream record has been promoted');
  if(!/^CC-MAIN-202[45]-\d{2}$/.test(row.collectionId)
    ||!/^crawl-data\/CC-MAIN-202[45]-\d{2}\/segments\/[A-Za-z0-9._-]+\/warc\/CC-MAIN-[A-Za-z0-9._-]+\.warc\.gz$/.test(row.warcFilename)
    ||row.warcFilename.includes('..')
    ||!row.warcFilename.startsWith('crawl-data/'+row.collectionId+'/')
    ||row.warcDataUrl!=='https://data.commoncrawl.org/'+row.warcFilename
    ||!Number.isSafeInteger(row.warcOffset)||row.warcOffset<0
    ||!Number.isSafeInteger(row.warcLength)||row.warcLength<=0||row.warcLength>MAX_COMPRESSED
    ||row.warcRangeEndInclusive!==row.warcOffset+row.warcLength-1
    ||row.httpRange!=='bytes='+row.warcOffset+'-'+row.warcRangeEndInclusive
    ||!/^[A-Z2-7]{32}$/.test(row.digest))
    fail('unsafe or corrupted index WARC range/digest metadata');
}
export function inspectSenateCommonCrawlWarcBytes(
  row:CcIndexRecord,compressedWarcRange:Buffer,siteLeads:CampaignPageLeadManifest,
) {
  validateRow(row);
  inspectRecordLinkage(row,siteLeads);
  if(compressedWarcRange.length!==row.warcLength||compressedWarcRange.length>MAX_COMPRESSED
    ||compressedWarcRange[0]!==0x1f||compressedWarcRange[1]!==0x8b)
    fail('WARC HTTP Range length does not match CDX index length or not gzip');
  let decoded:Buffer;
  try{decoded=gunzipSync(compressedWarcRange,{maxOutputLength:MAX_UNCOMPRESSED});}
  catch{fail('corrupted/oversize gzip member or bad gzip CRC');}
  const marker=Buffer.from('\r\n\r\n');
  const headerEnd=decoded.indexOf(marker);
  if(headerEnd<8||headerEnd>65536)fail('missing/oversized WARC response headers');
  const warc=readHeaders(decoded.subarray(0,headerEnd).toString('latin1'));
  if(!/^WARC\/1\.[01]$/.test(warc.statusLine))fail('not a WARC record');
  if(warc.fields.get('warc-type')!=='response')fail('WARC revisit/redirect/metadata is not original response body');
  if(!/^application\/http(?:\s*;|$)/i.test(requireHeader(warc.fields,'content-type')))
    fail('not original HTTP response WARC media');
  const warcDate=requireHeader(warc.fields,'warc-date');
  if(dateMs(warcDate)!==dateMs(row.capturedAt))fail('WARC capture date differs from index timestamp');
  if(!sameWebUrl(requireHeader(warc.fields,'warc-target-uri'),row.originalUrl))
    fail('WARC target URL differs from candidate/index original URL');
  const bodyLenText=requireHeader(warc.fields,'content-length');
  if(!/^[1-9]\d*$/.test(bodyLenText))fail('invalid WARC Content-Length');
  const contentLength=Number(bodyLenText),blockStart=headerEnd+marker.length;
  if(!Number.isSafeInteger(contentLength)||contentLength>MAX_UNCOMPRESSED
    ||blockStart+contentLength>decoded.length)fail('WARC block length overflow or truncated record');
  const contentBlock=decoded.subarray(blockStart,blockStart+contentLength);
  const trailer=decoded.subarray(blockStart+contentLength);
  if(!trailer.equals(marker)&&!trailer.equals(Buffer.from('\r\n')))
    fail('unexpected additional/truncated bytes in one-record gzip range');
  const declaredBlock=requireHeader(warc.fields,'warc-block-digest');
  if(declaredBlock!=='sha1:'+sha1B32(contentBlock))
    fail('WARC block checksum mismatch');
  const httpSeparator=contentBlock.indexOf(marker);
  if(httpSeparator<=0||httpSeparator>65536)fail('missing HTTP response headers');
  const http=readHeaders(contentBlock.subarray(0,httpSeparator).toString('latin1'));
  if(!/^HTTP\/1\.[01] 200(?:\s|$)/.test(http.statusLine))
    fail('not original HTTP 200 response');
  const type=requireHeader(http.fields,'content-type').split(';')[0].trim().toLowerCase();
  if(!['text/html','text/plain','application/xhtml+xml'].includes(type)||type!==row.mime)
    fail('HTTP payload media mismatch with source index');
  const encoding=http.fields.get('content-encoding');
  const transfer=http.fields.get('transfer-encoding');
  if((encoding&&encoding.toLowerCase()!=='identity')||transfer)
    fail('encoded/chunked HTTP payload requires a separately verified decoder');
  const payload=contentBlock.subarray(httpSeparator+marker.length);
  if(!payload.length)fail('empty candidate page payload');
  const payloadDigest=sha1B32(payload);
  if(requireHeader(warc.fields,'warc-payload-digest')!=='sha1:'+payloadDigest
    ||row.digest!==payloadDigest)
    fail('WARC page payload checksum disagrees with Common Crawl index and WARC headers');
  return {
    report:{
      schema:SENATE_CC_WARC_BYTE_AUDIT_VERSION,
      candidateName:row.candidateName,district:row.district,
      campaignHost:row.candidateHost,originalUrl:row.originalUrl,
      collectionId:row.collectionId,
      indexReportedCaptureTime:row.capturedAt,
      strictlyPreGeneralElection:true,
      strictlyPrePrimaryElection:row.isStrictlyBeforePrimary,
      sourcePagePathFrom2026ResearchCopy:row.isKnownOriginalIssuePageUrl,
      compressedRangeSha256:hash(compressedWarcRange,'sha256'),
      originalWarcUncompressedSha256:hash(decoded,'sha256'),
      originalHttpResponseBlockSha256:hash(contentBlock,'sha256'),
      originalHttpPagePayloadSha256:hash(payload,'sha256'),
      indexSha1PayloadBase32:row.digest,
      warcBlockDigestCrossChecksPassed:true,
      warcPayloadDigestCrossChecksPassed:true,
      exactTargetUrlAndCaptureTimeMatched:true,
      gzipLengthAndCrcMatched:true,
      dataFileUrl:row.warcDataUrl,httpRange:row.httpRange,
      bytesCrossCheckedAgainstProvidedIndex:true,
      originalCommonCrawlIndexResponseIndependentlyAuthenticated:false,
      originalRemoteWarcByteRangeRetrievalIndependentlyAuthenticated:false,
      candidateAttributionAndStatementTextIndependentlyVerified:false,
      firstHistoricalStatementPublicBy:null,
      campaignStanceEvidencePromoted:false,
      forecastEligible:false,
      statewideCampaignCompletenessCertified:false,
    },
    originalHttpPagePayloadBytes:Buffer.from(payload),
  };
}
