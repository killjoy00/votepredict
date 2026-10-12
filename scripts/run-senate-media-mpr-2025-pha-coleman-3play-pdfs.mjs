import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runPhaColemanTranscriptPdfProbe} from './probe-senate-media-mpr-2025-pha-coleman-3play-pdfs.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require only --output artifacts/metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only public metadata JSON under artifacts permitted');
const r=await runPhaColemanTranscriptPdfProbe();
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
