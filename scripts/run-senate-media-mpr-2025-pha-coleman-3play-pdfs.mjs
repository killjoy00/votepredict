import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {runPhaColemanTranscriptPdfProbe} from './probe-senate-media-mpr-2025-pha-coleman-3play-pdfs.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require only --output artifacts/metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only public metadata JSON under artifacts permitted');
const r=await runPhaColemanTranscriptPdfProbe();
const pinned=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-2025-pha-coleman-3play-originals-20261011.json',import.meta.url),'utf8'));
if(pinned.version!=='mpr-2025-pha-coleman-3play-pdf-public-hash-provenance-receipts-v1' || pinned.sources.length!==r.reports.length)throw Error('Original receipts changed');
for(let i=0;i<r.reports.length;i++){
 const a=r.reports[i],b=pinned.sources[i];
 if(a.id!==b.id||a.episodeUrl!==b.currentPublisherMprEpisode||a.apm3PlayPdfUrl!==b.currentFirstPartyApm3PlayPdf
  ||a.current.pdfStatus!=='current_apm_original_pdf_bytes_sha256_verified'
  ||a.current.pdfSha256!==b.currentPdf.rawSha256||a.current.pdfSha1Base32!==b.currentPdf.sha1Base32
  ||a.current.pdfBytes!==b.currentPdf.bytes
  ||a.current.embeddedPdfDates?.embeddedPdfCreationDate!==b.currentPdf.embeddedCreationDateSelfDeclared
  ||a.current.httpLastModified!==b.currentPdf.currentHttpLastModified
  ||a.current.currentPublisherHtmlCues?.literalExactApmCdnPdfUrlReferenced!==true
  ||a.current.currentPublisherHtmlCues?.selectedSenatorLabelVisible!==true
  ||a.current.currentPublisherHtmlCues?.shortSelectedUtteranceVisible!==true)
    throw Error('Publisher PDF or printed attribution changed; require fresh public source receipt');
}
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(r,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({
 version:r.version,leads:r.sourcePdfUrls,authenticatedHistoricalOriginals:r.verified2025OriginalApMTranscriptPdfCaptures,
 sources:r.reports.map(x=>({
  id:x.id,day:x.publisherDisplayedDay,
  currentMprHtml:x.current.htmlStatus,
  currentMprCues:x.current.currentPublisherHtmlCues,
  currentPdf:x.current.pdfStatus,
  currentPdfSha256:x.current.pdfSha256,
  currentPdfBytes:x.current.pdfBytes,
  currentPdfMetadata:x.current.embeddedPdfDates,
  currentPdfHttpLastModified:x.current.httpLastModified,
  WaybackIndex:x.wayback.status,
  WaybackOriginals:x.wayback.historicalPdfReplays.map(c=>({utc:c.captureUtc,status:c.status,rawSha256:c.rawSha256,bytes:c.bytes})),
  CommonCrawlIndexes:x.commonCrawl.collections.map(c=>({
   collection:c.collection,status:c.status,originals:c.originalAttempts.map(v=>({utc:v.utc,status:v.status,rawSha256:v.rawSha256,bytes:v.bytes}))
  })),
  historicalOriginalCaptures:x.authenticatedHistoricalOriginalPdfCaptures,
  earliestVerifiedArchiveCaptureUtc:x.earliestVerifiedPublicArchiveCaptureUtc
 })),
 noPrivateData:true,noModelOrHistoricalVotePromotion:true,noRawSourceBytesPersisted:true
}));
