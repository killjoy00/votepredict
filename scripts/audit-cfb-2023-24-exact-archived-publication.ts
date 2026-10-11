/**
 * Finance #864: bounded original 2024/25 Wayback CDX archival source probe.
 * A live 2026 URL, legal release bound, Board receipt, CDX listing or
 * archived HTML page cannot establish public-by of a specific PDF version.
 * Only validate an exact-version archived PDF when actual binary SHA256
 * matches previously authenticated historical CFB source, and no HOLD.
 *
 * Output only metadata; never commit original report PDF, donor, contact,
 * transactions, raw archived HTML, raw CDX response or raw archive PDF.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {
 ORIGINAL_CFB_ARCHIVE_PUBLICBY_VERSION,FOUR_EXACT_ARCHIVE_PILOT_IDS,
 selectFourRealOriginalArchiveAuditTargets,strictCdxReportVersionCaptures,
 classifyExactArchivePdfBinaryProof,
 type ArchivedCfbExactVersionTarget,type CdxValidCapture,
} from '../src/evidence/cfb-2023-24-archived-pdf-publicby-proof.js';
const SOURCE='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const UA='Mozilla/5.0 VotePredict/2.0 original historical source research';
function failureClass(err:unknown):string{
 const s=err instanceof Error?err.message:String(err);
 if(/timed?out|abort/i.test(s))return'archival_service_timeout';
 if(/archive.*http|cdx.*http/i.test(s))return'archival_service_http_unavailable';
 if(/CDX|capture columns|Malformed/i.test(s))return'archival_capture_metadata_invalid';
 return'archive_source_unverified';
}
async function archiveCdxProbe(target:ArchivedCfbExactVersionTarget){
 const endpoint=new URL('https://web.archive.org/cdx/search/cdx');
 endpoint.searchParams.set('url',target.sourceSnapshotCfbReportUrl);
 endpoint.searchParams.set('matchType','exact');
 endpoint.searchParams.set('output','json');
 endpoint.searchParams.set('fl','timestamp,original,statuscode,mimetype,digest');
 endpoint.searchParams.set('from','2024');endpoint.searchParams.set('to','2026');
 endpoint.searchParams.set('filter','statuscode:200');
 endpoint.searchParams.set('collapse','digest');
 endpoint.searchParams.set('pageSize','20');
 const probe={
  originalVersionId:target.versionId,
  originalLivePdfUrl:target.sourceSnapshotCfbReportUrl,
  originalAuthenticatedSHA256:target.originalCfbPdfSha256,
  originalSourceStatus:target.sourceStatus,
  archivedOriginalSourceAuthenticBeforeProbe:target.authenticOriginalPDF,
  requestedFrom:'2024',requestedThrough:'2026',
  archivalIndexApi:'https://web.archive.org/cdx/search/cdx',
 };
 const output={
  ...probe,
  queryStatus:'unknown' as string,
  originalCdxQuerySHA256:createHash('sha256').update(endpoint.toString()).digest('hex'),
  cdxResponseSha256:null as string|null,
  cdxResponseBytes:null as number|null,
  exactArchivedVersionCdxPdfCaptureCandidates:0,
  inspectedExactArchiveBinaryCount:0,
  archivedSourceHits:[] as Array<{captureUtc:string;digest:string;
   archivedOriginalUrl:string;actualArchivedSha256:string|null;
   archivedBinaryMatchesOriginalSha:boolean;captureProvesExactVersionHistoricallyPublicBy:string|null}>,
  firstProvenHistoricalPublicBy:null as string|null,
  errorClass:null as string|null,
 };
 try{
  const r=await fetch(endpoint,{headers:{'user-agent':UA,accept:'application/json'},
   redirect:'follow',signal:AbortSignal.timeout(34_000)});
  if(!r.ok)throw Error('archive CDX HTTP '+r.status);
  const url=new URL(r.url);
  if(url.protocol!=='https:'||url.hostname!=='web.archive.org')
   throw Error('Wayback CDX source redirected to untrusted host');
  const b=new Uint8Array(await r.arrayBuffer());
  if(b.byteLength>2_000_000||b.byteLength<2)throw Error('Wayback CDX response unbounded or empty');
  const raw=new TextDecoder().decode(b);
  output.cdxResponseSha256=createHash('sha256').update(b).digest('hex');
  output.cdxResponseBytes=b.byteLength;
  if(!raw.trim().startsWith('['))throw Error('Wayback original CDX response not JSON');
  const parsed=JSON.parse(raw) as unknown;
  const captures=strictCdxReportVersionCaptures({target,rawCdxJson:parsed});
  output.exactArchivedVersionCdxPdfCaptureCandidates=captures.length;
  output.queryStatus='archival_cdx_response_verified';
  for(const capture of captures.slice(0,3)){
   const entry=await inspectArchivedBinary(target,capture);
   output.inspectedExactArchiveBinaryCount++;
   output.archivedSourceHits.push(entry);
   if(entry.captureProvesExactVersionHistoricallyPublicBy&&
     (!output.firstProvenHistoricalPublicBy||
      entry.captureProvesExactVersionHistoricallyPublicBy<output.firstProvenHistoricalPublicBy))
    output.firstProvenHistoricalPublicBy=entry.captureProvesExactVersionHistoricallyPublicBy;
  }
 }catch(err){
  output.queryStatus='HOLD_archival_source_not_positively_authenticated';
  output.errorClass=failureClass(err);
 }
 return output;
}
async function inspectArchivedBinary(target:ArchivedCfbExactVersionTarget,capture:CdxValidCapture){
 const result={captureUtc:capture.archiveCaptureUtc,digest:capture.digest,
  archivedOriginalUrl:capture.archivedOriginalUrl,actualArchivedSha256:null as string|null,
  archivedBinaryMatchesOriginalSha:false,captureProvesExactVersionHistoricallyPublicBy:null as string|null};
 const url='https://web.archive.org/web/'+capture.timestamp+
  'id_/'+capture.archivedOriginalUrl;
 try{
  const res=await fetch(url,{headers:{'user-agent':UA,accept:'application/pdf'},
   redirect:'follow',signal:AbortSignal.timeout(34_000)});
  const final=new URL(res.url);
  if(final.protocol!=='https:'||final.hostname!=='web.archive.org')
   return result;
  if(!res.ok)return result;
  const b=new Uint8Array(await res.arrayBuffer());
  if(b.byteLength>3_000_000||b.byteLength<1000)return result;
  const verification=classifyExactArchivePdfBinaryProof({
   target,capture,archiveHttpStatus:res.status,archivePdfBytes:b});
  result.actualArchivedSha256=verification.archiveBinarySha256;
  result.archivedBinaryMatchesOriginalSha=
   verification.identicalSourceAuthenticatedVersionBinarySha256;
  result.captureProvesExactVersionHistoricallyPublicBy=
   verification.originalHistoricalVersionPublicBy;
 }catch{/* Archive capture unverified; no public-by from source timeout. */}
 return result;
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])throw Error('Only --output artifacts/<new>.json');
 const path=resolve(a[1]);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Write only bounded new source metadata artifact JSON');
 const ledger=readFileSync(SOURCE,'utf8');
 const targets=selectFourRealOriginalArchiveAuditTargets(ledger);
 const probes=await Promise.all(targets.map(archiveCdxProbe));
 const actualPositive=probes.filter(x=>x.firstProvenHistoricalPublicBy!==null);
 const held=probes.filter(x=>x.originalSourceStatus.startsWith('HOLD'));
 const output={
  schemaVersion:ORIGINAL_CFB_ARCHIVE_PUBLICBY_VERSION,issue:864,
  observedAt:new Date().toISOString(),
  originalSource:{path:SOURCE,gitBlobSha:'bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388',
   originalReportVersionReferencesReviewed:71,
   originalAuthenticatedPdfBodiesPrior:68,originalHeldIdentityRefsPrior:2,
   sameBinaryVersionAliasPrior:1},
  targetedOriginalCFBReportVersions:FOUR_EXACT_ARCHIVE_PILOT_IDS,
  sourceProbes:probes,
  summary:{
   originalVersionTargetsTested:targets.length,
   archivalQueriesWithUsableOriginalCDXMetadata:probes.filter(x=>x.queryStatus==='archival_cdx_response_verified').length,
   exactArchivedPDFCaptureCandidatesFound:probes.reduce((n,x)=>n+x.exactArchivedVersionCdxPdfCaptureCandidates,0),
   originalArchivedPDFBinarySHAExactMatchPublicByProved:actualPositive.length,
   historicallyPublicByVersionIdsProved:actualPositive.map(x=>x.originalVersionId),
   historicalPublicByUnknownOrUnprovenForOther71Versions:true,
   heldSourcePDFVersionsNeverPromoted:held.every(x=>x.firstProvenHistoricalPublicBy===null),
   archiveIndexFailureOrEmptyResultsDoNotProveUnavailability:true,
   2023And2024LegallyOwedYeReportDenominator:null,
  },
  limits:{
   WaybackIndexHitIsNotOriginalPDFProof:true,
   exactArchivedOriginalPDFSHAEqualityRequired:true,
   originalCfbReceiptNotPublicBy:true,
   originalLaw8AMNextDayFloorNotActualPublication:true,
   legalRequiredFilingDutyNotEstablished:true,
   noHistoricPredictionEligibilityPromotion:true,
  },
  safeguards:{originalCfbRawPdfOrArchivedPdfNotSaved:true,
   archiveFullOriginalPagesOrRawCDXNotSaved:true,
   noDonorContactOrFinancialTransactionRows:true,noProductionDBReadWrite:true,
   noTrainingModelsForecastSchedulerServingOr2027Changes:true,
   keepIssue864Open:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({
  issue:864,originalFourExactIds:FOUR_EXACT_ARCHIVE_PILOT_IDS,
  sourceResults:probes.map(x=>({
   id:x.originalVersionId,queryStatus:x.queryStatus,error:x.errorClass,
   cdxPdfCandidates:x.exactArchivedVersionCdxPdfCaptureCandidates,
   pdfBodiesChecked:x.inspectedExactArchiveBinaryCount,
   provenPublicBy:x.firstProvenHistoricalPublicBy})),
  ...output.summary,output:path,productionWrites:0,
 },null,2));
}
main().catch(err=>{
 console.error(failureClass(err));process.exitCode=1;
});
