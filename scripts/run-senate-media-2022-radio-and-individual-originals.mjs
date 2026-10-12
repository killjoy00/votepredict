import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {run2022MprRadioIdentity} from './probe-senate-media-mpr-2022-benson-kunesh-audio-identity.mjs';
import {runSevenCaucusIndividualSourceOriginals} from './probe-senate-media-2021-22-25-individual-caucus-originals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==3||args[1]!=='--output'||!args[2]||!['radio','statements'].includes(args[0]))
 throw Error('Usage: radio|statements --output artifacts/source-proof.json');
const dest=resolve(args[2]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))
 throw Error('Original audio and raw article bytes never persisted; artifact metadata only');
const r=args[0]==='radio'?await run2022MprRadioIdentity():await runSevenCaucusIndividualSourceOriginals();
const pinned=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-2022-radio-and-2021-25-caucus-20261011.json',import.meta.url),'utf8'));
if(pinned.version!=='senate-media-2022-radio-audio-and-seven-individual-statements-evidence-receipts-v1')
 throw Error('Unexpected previously authenticated public source manifest');
if(args[0]==='radio'){
 const baseline=pinned.historical2022Radio;
 if(r.currentPages.length!==2||r.archivedSeparateProgramPageVersions.length!==2)throw Error('Original MPR publisher sample changed');
 for(let i=0;i<r.archivedSeparateProgramPageVersions.length;i++){
  const x=r.archivedSeparateProgramPageVersions[i],old=baseline.relatedHistoricalOriginalPageVersions[i];
  if(x.archiveUtc!==old.utc||x.previouslyIndexedOriginalSha1!==old.indexedSha1
   ||x.previouslyRawSha256!==old.rawHtmlSha256||x.previouslyExactRawBytes!==old.rawBytes)
    throw Error('Original 2022 related MPR archival identity changed');
  if(x.status==='historical_original_sha1_sha256_reverified'){
   if(x.source.rawHtmlSha256!==old.rawHtmlSha256||x.source.bytes!==old.rawBytes
    ||JSON.stringify(x.source.firstPartyMediaEvidence.candidateMediaUrlFingerprints.map(a=>a.originPathSha256).sort())
      !==JSON.stringify(old.firstPartyAudioMp3UrlSha256Fingerprints.slice().sort()))
    throw Error('2022 original related MPR audio source identity changed; independent public receipt review required');
  }
 }
 for(let i=0;i<r.currentPages.length;i++){
  const cur=r.currentPages[i];
  if(cur.source){
   const expected=i===0?baseline.namedCurrentFirstPartyAudioMp3UrlSha256Fingerprints:baseline.relatedCurrentFirstPartyAudioMp3UrlSha256Fingerprints;
   const found=cur.source.firstPartyMediaEvidence.candidateMediaUrlFingerprints.map(a=>a.originPathSha256);
   if(JSON.stringify(found.slice().sort())!==JSON.stringify(expected.slice().sort()))
    throw Error('Current MPR audio asset reference changed; do not assume historical 2022 program equivalence');
  }
 }
 if(r.currentTwoPagesMediaFingerprintComparison.identicalAudioAssetFingerprintCount!==null
  &&r.currentTwoPagesMediaFingerprintComparison.identicalAudioAssetFingerprintCount!==0)
  throw Error('Media URI fingerprint match changed, investigate separately; named voices cannot be inferred');
}else{
 if(r.sources?.length!==7||pinned.individualSenateFirstPartyStatementOriginals?.length!==7)
  throw Error('Expected seven individual original Senate caucus study sources');
 for(let i=0;i<r.sources.length;i++){
  const actual=r.sources[i],expected=pinned.individualSenateFirstPartyStatementOriginals[i];
  if(actual.id!==expected.id||actual.senator!==expected.senator||actual.publisherDisplayedDay!==expected.publisherDisplayedDay)
   throw Error('Different first-party published senator/source identity');
  const originals=[...actual.originalWayback.originals,...actual.originalCommonCrawl.selectedCollections.flatMap(c=>c.originals)]
    .filter(v=>v.replayStatus==='sha1_authenticated_original_publisher_html'
      ||v.replayStatus==='sha1_authenticated_original_commoncrawl_warc_html');
  for(const v of originals){
   if(!expected.originalHtmlSourceProofs.some(p=>p.archiveCaptureUtc===v.utc
    &&p.indexedOriginalSha1Base32===v.indexedSha1&&p.verifiedRawHtmlSha256===v.bodySha256
    &&p.rawHtmlBytes===v.bodyBytes&&v.shortCurrentSelectedPolicyFragmentFoundOnOriginalPage===true))
    {console.error('New or modified public archived source, metadata only',JSON.stringify({
      id:actual.id,utc:v.utc,sha1:v.indexedSha1,sha256:v.bodySha256,bytes:v.bodyBytes}));
      throw Error('Public archived original requires independent review before new SHA/turn claims');}
  }
 }
}
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
