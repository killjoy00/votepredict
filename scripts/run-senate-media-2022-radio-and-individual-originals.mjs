import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {run2022MprRadioIdentity} from './probe-senate-media-mpr-2022-benson-kunesh-audio-identity.mjs';
import {runSevenCaucusIndividualSourceOriginals} from './probe-senate-media-2021-22-25-individual-caucus-originals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==3||args[1]!=='--output'||!args[2]||!['radio','statements'].includes(args[0]))
 throw Error('Usage: radio|statements --output artifacts/source-proof.json');
const dest=resolve(args[2]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))
 throw Error('Original audio and raw article bytes never persisted; artifact metadata only');
const r=args[0]==='radio'?await run2022MprRadioIdentity():await runSevenCaucusIndividualSourceOriginals();
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(r,null,2)+'\n',{mode:0o600,flag:'wx'});
if(args[0]==='radio'){
 console.log(JSON.stringify({
  version:r.version,current:r.currentPages.map(x=>({id:x.id,status:x.availability,
   htmlBytes:x.source?.bytes??null,sha256:x.source?.rawHtmlSha256??null,
   assetCandidates:x.source?.firstPartyMediaEvidence?.candidateMediaUrlFingerprints??null,
   mediaIds:x.source?.firstPartyMediaEvidence?.nonSensitiveMediaIdDigests??null})),
  archivedOtherPage:r.archivedSeparateProgramPageVersions.map(x=>({utc:x.archiveUtc,status:x.status,
   sha256:x.source?.rawHtmlSha256??null,
   candidates:x.source?.firstPartyMediaEvidence?.candidateMediaUrlFingerprints??null,
   mediaIds:x.source?.firstPartyMediaEvidence?.nonSensitiveMediaIdDigests??null})),
  currentComparison:r.currentTwoPagesMediaFingerprintComparison,
  archiveToBensonKunesh:r.separate2022ArchivedPageAudioVsCurrentNamedPage,
  noOriginalAudioContentsAccessed:true
 }));
}else{
 console.log(JSON.stringify({
  version:r.version,firstPartyUrls:r.countExactFirstPartyOriginalLeadUrls,
  originalBodies:r.authenticatedHistoricPublisherOriginalBodies,
  originalUrls:r.distinctOriginalUrlsHistoricallyAuthenticated,
  sources:r.sources.map(x=>({id:x.id,day:x.publisherDisplayedDay,senator:x.senator,
   current:x.current.status,currentCue:x.current.chosenShortCueOnCurrentPage,
   wayback:x.originalWayback.status,
   originals:x.originalWayback.originals.map(v=>({utc:v.utc,status:v.replayStatus,
    sha1:v.indexedSha1,sha256:v.bodySha256,bytes:v.bodyBytes,cue:v.shortCurrentSelectedPolicyFragmentFoundOnOriginalPage})),
   commonCrawl:x.originalCommonCrawl.selectedCollections.map(v=>({id:v.collection,status:v.index,candidates:v.candidates})),
   originalCaptureUtc:x.earliestVerifiedOriginalHtmlCaptureUtc,postEvent:x.postEventCannotPredictEarlierEvent
  })),
  noRawOriginalStatementsPersisted:true,noPrivateDataOrForecastChanges:true
 }));
}
