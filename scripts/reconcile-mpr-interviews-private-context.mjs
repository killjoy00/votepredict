/**
 * Private operator-only offline reconciliation of publicly authenticated MPR
 * originals against the existing 44-seed local-news SELECT-only JSONL export.
 * The source-document IDs, raw SHA fingerprints, and any export rows remain
 * inside the calling process. Output is aggregate-only and non-overwriting.
 * NEVER run against CI, in a public Actions job, or with server privileges.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const VERSION='mpr-six-interviews-private-context-scope-exact-original-reconcile-v1';
export const RECEIPT_FILE=new URL('../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json',import.meta.url);
const SHA=/^[a-f0-9]{64}$/;
const STAMP=/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const validClock=s=>typeof s==='string'&&STAMP.test(s)&&!Number.isNaN(Date.parse(s))
  &&new Date(s).toISOString()===s.replace('Z','.000Z');
export function expectedPublicOriginals(receipt){
 if(receipt?.version!=='mpr-six-senator-interviews-public-original-and-seed-receipts-v1'
  ||receipt.urls?.length!==6||receipt.originals?.historicallySha1AuthenticatedOriginalHtmlCaptureCount!==5)
  throw Error('Public original receipt format mismatch');
 const list=[],seen=new Set();
 for(const lead of receipt.urls){
  if(!/^https:\/\/www\.mprnews\.org\/(?:episode|story)\/20(?:21|22|23|24|25)\//.test(lead.url))throw Error('Public MPR URL invalid');
  if(!Array.isArray(lead.originals))throw Error('Public original sources absent');
  for(const x of lead.originals){
   if(!validClock(x.captureUtc)||!SHA.test(x.sha256)||!Number.isSafeInteger(x.bytes)
    ||x.bytes<40||x.bytes>2_500_000||!/^[A-Z2-7]{32}$/.test(x.sha1))throw Error('Invalid original source proof');
   const key=lead.url+'|'+x.captureUtc+'|'+x.sha256;
   if(seen.has(key))throw Error('Repeated original source identity');
   seen.add(key);
   const t=x.captureUtc.replace(/[-:TZ]/g,'');
   list.push(Object.freeze({leadId:lead.id,originalUrl:lead.url,archiveUrl:'https://web.archive.org/web/'+t+'id_/'+lead.url,capture:x.captureUtc,sha:x.sha256,archiveSha1:x.sha1}));
  }
 }
 if(list.length!==5)throw Error('Selected historical original count changed');
 return list;
}
function archiveCapture(archiveUrl,originalUrl){
 if(typeof archiveUrl!=='string'||typeof originalUrl!=='string')return null;
 const m=/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https:\/\/.+)$/.exec(archiveUrl);
 if(!m||m[2]!==originalUrl)return null;
 const n=m[1],utc=n.slice(0,4)+'-'+n.slice(4,6)+'-'+n.slice(6,8)+'T'+n.slice(8,10)+':'+n.slice(10,12)+':'+n.slice(12,14)+'Z';
 return validClock(utc)?utc:null;
}
function rowFingerprint(row){
 return JSON.stringify([row.originalUrl,row.archiveUrl,row.archiveCapturedAt,row.sourceSha256,row.sourceUrl,row.sourceKind,row.publisher,row.seedId,row.archiveDigest]);
}
export function reconcilePrivateContextRows(rows,receipt){
 const originals=expectedPublicOriginals(receipt);
 if(!Array.isArray(rows)||rows.length>50_000)throw Error('Invalid bounded private media export');
 const groups=new Map(),invalidIds=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)
    ||typeof row.sourceDocumentId!=='string'||!row.sourceDocumentId
    ||typeof row.evidenceId!=='string'||!row.evidenceId
    ||typeof row.sourceSha256!=='string'||!SHA.test(row.sourceSha256)
    ||typeof row.originalUrl!=='string'||typeof row.archiveUrl!=='string'
    ||typeof row.archiveCapturedAt!=='string')throw Error('Private media export malformed');
  // Strict source consistency before matching: context entries referencing one
  // sourceDocumentId may have different evidenceId/member lists, but NEVER
  // different archived original source identity, SHA or storage source URL.
  const fp=rowFingerprint(row),prior=groups.get(row.sourceDocumentId);
  if(prior&&prior.fp!==fp)invalidIds.add(row.sourceDocumentId);
  else if(prior){prior.contextRows++;}
  else groups.set(row.sourceDocumentId,{fp,contextRows:1,row});
 }
 const answer=[];
 for(const expected of originals){
  const sameOriginal=[...groups.values()].filter(g=>
   g.row.originalUrl===expected.originalUrl
   ||g.row.archiveUrl===expected.archiveUrl);
  const exact=sameOriginal.filter(g=>g.row.originalUrl===expected.originalUrl
   &&g.row.archiveUrl===expected.archiveUrl
   &&g.row.archiveCapturedAt===expected.capture
   &&g.row.sourceUrl===expected.archiveUrl
   &&g.row.sourceSha256===expected.sha
   &&g.row.archiveDigest===expected.archiveSha1
   &&g.row.sourceKind==='wayback_local_trade_news'
   &&g.row.publisher==='MPR News'
   &&g.row.seedId==='mpr-news-story-archive'
   &&archiveCapture(g.row.archiveUrl,g.row.originalUrl)===expected.capture
   &&!invalidIds.has(g.row.sourceDocumentId));
  const corrupted=sameOriginal.some(g=>invalidIds.has(g.row.sourceDocumentId)
   ||archiveCapture(g.row.archiveUrl,g.row.originalUrl)!==g.row.archiveCapturedAt);
  const conflictingSnapshot=sameOriginal.some(g=>g.row.archiveUrl===expected.archiveUrl
   &&g.row.sourceSha256!==expected.sha);
  const sameUrlDiffCapture=sameOriginal.some(g=>g.row.originalUrl===expected.originalUrl&&g.row.archiveUrl!==expected.archiveUrl);
  const match=exact.length>0;
  // Only shape/status leaves scope. No row IDs/hashes/source URLs in output.
  answer.push({
   publicOriginalId:expected.leadId+'@'+expected.capture,
   status:match?'exact_private_source_record_in_this_export':
    corrupted||conflictingSnapshot?'conflicting_or_invalid_private_provenance':
    sameUrlDiffCapture?'same_original_publisher_url_other_archived_version_only':
    sameOriginal.length?'same_original_url_or_archive_alias_unverified':
    'not_observed_in_bounded_context_export',
   exactPrivateSourceDocumentCount:exact.length,
   exactPrivateContextItemCount:exact.reduce((n,g)=>n+g.contextRows,0),
   observedSamePublisherOriginalUrlInExport:sameOriginal.some(g=>g.row.originalUrl===expected.originalUrl),
   ambiguousOrInconsistentSourceRows:corrupted||conflictingSnapshot,
   sourceAbsenceFromAllVotePredictNotEstablished:!match,
   individualSenatorFullSpeechVerified:false,
   voteModelPredictionEligibilityEstablished:false
  });
 }
 const overall={
  version:VERSION,
  studyScope:'44_curated_local_trade_news_wayback_context_export_only',
  totalContextRowsInSuppliedExport:rows.length,
  distinctSourceDocumentsInExport:groups.size,
  ambiguousSharedSourceDocumentIds:invalidIds.size,
  authenticatedPublicOriginalsExamined:originals.length,
  matchedExactOriginalsWithinExport:answer.filter(x=>x.status==='exact_private_source_record_in_this_export').length,
  originalUrlOtherCaptureOnly:answer.filter(x=>x.status==='same_original_publisher_url_other_archived_version_only').length,
  notObservedInExport:answer.filter(x=>x.status==='not_observed_in_bounded_context_export').length,
  conflictingOrInvalid:answer.filter(x=>x.status==='conflicting_or_invalid_private_provenance').length,
  otherUnverifiedAlias:answer.filter(x=>x.status==='same_original_url_or_archive_alias_unverified').length,
  originalStatuses:answer,
  noClaimAboutAbsenceInOtherIngestionPipelines:true,
  actualQuoteCountHumanApproved:0,originalAudioFilesCompared:0,
  stateWideOrMprPublicationDenominatorKnown:false,
  neverAutopromoteStatementsOrBackdateToBroadcastDay:true,
  noDataBaseOrNetworkAccess:true,originalPrivateRowsOrIdsOrSHAInReport:false
 };
 return overall;
}
export function parsePrivateJsonl(text){
 if(typeof text!=='string'||!text||Buffer.byteLength(text)>80_000_000)throw Error('Private input empty or too large');
 const lines=text.trimEnd().split(/\r?\n/);
 if(lines.length>50_000)throw Error('Private row limit');
 return lines.map(line=>{let data;try{data=JSON.parse(line)}catch{throw Error('Invalid private JSONL')}
  if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Invalid private row object');return data;});
}
function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--context'||args[2]!=='--output')throw Error('Usage: --context PRIVATE-export.jsonl --output PRIVATE-report.json');
 const input=resolve(args[1]),output=resolve(args[3]);
 if(input===output||!/\.(?:jsonl|ndjson)$/.test(input)||!output.endsWith('.json'))throw Error('Distinct private JSONL and output JSON paths required');
 const raw=readFileSync(input,'utf8');
 const receipt=JSON.parse(readFileSync(RECEIPT_FILE,'utf8'));
 const result=reconcilePrivateContextRows(parsePrivateJsonl(raw),receipt);
 writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({
  version:result.version,sourceCount:result.authenticatedPublicOriginalsExamined,
  exactOriginalsWithinScopedExport:result.matchedExactOriginalsWithinExport,
  notObservedWithinScopedExport:result.notObservedInExport,
  inconsistentPrivateSources:result.conflictingOrInvalid,
  otherCaptureOnly:result.originalUrlOtherCaptureOnly,
  reportIsPrivate:true,noDatabaseOrNetwork:true
 }));
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 try{main()}catch{console.error('Private-only media reconciliation failed; inspect authorized local input and destination');process.exitCode=1;}
}
