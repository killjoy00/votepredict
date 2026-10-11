import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runHauschildPdfOriginalProbe} from './probe-senate-media-mpr-hauschild-3play-pdf.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require --output artifacts/metadata.json');
const path=resolve(args[1]);
if(!path.startsWith(resolve(root,'artifacts')+'/')||!path.endsWith('.json'))throw Error('No publisher PDF or source HTML may be persisted');
const r=await runHauschildPdfOriginalProbe();
mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({version:r.version,
 currentPdfStatus:r.currentTranscriptPdf.status,
 currentPdfSha256:r.currentTranscriptPdf.rawSha256,
 currentPdfBytes:r.currentTranscriptPdf.bytes,
 currentPdfEmbeddedDateFields:r.currentTranscriptPdf.pdfMetadata?.selectedEmbeddedDateFields??null,
 originalPageRechecks:r.exactHistoricalMprHtmlVersions.map(x=>({utc:x.captureUtc,status:x.status,originalPdfLinkFound:x.selectedReferences?.exact3PlayCdnPdfUrlStringFound??null,
  printedTranscriptCueFound:x.selectedReferences?.selectedHistoricalTranscriptPhraseLiteralFound??null})),
 originalPdfWaybackIndex:r.historicalExactTranscriptPdfWaybackIndex.indexStatus,
 originalPdfWaybackCaptures:r.historicalExactTranscriptPdfWaybackIndex.firstTwoArchivePdfReplayAttempts.map(x=>({utc:x.captureUtc,status:x.status})),
 originalPdfCommonCrawl:r.historicalExactTranscriptPdfCommonCrawl.collections.map(x=>({collection:x.collection,indexStatus:x.indexStatus,
   captures:x.firstWarcReplayAttempts.map(y=>({utc:y.utc,status:y.status}))})),
 historicallyAuthenticatedOriginalPdfBinaries:r.historicallySha1AuthenticatedOriginalTranscriptPdfVersions,
 noPdfOrHtmlOrWarcPersisted:true,noHistoricPublicationClockInferred:true}));
