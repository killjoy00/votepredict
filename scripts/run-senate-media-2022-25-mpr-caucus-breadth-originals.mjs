import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {runMprAndCaucusSenateEvidenceBreadth} from './probe-senate-media-2022-25-mpr-caucus-breadth-originals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/public-bounded-source-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only source metadata under ignored artifacts/');
const r=await runMprAndCaucusSenateEvidenceBreadth();
const receipt=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json',import.meta.url),'utf8'));
if(receipt.version!=='senate-media-nine-mpr-caucus-public-original-receipts-v1'
 ||receipt.sourceOriginals?.length!==10||r.publicFirstPartyUrlsTested!==9)throw Error('Public original source study scope changed');
for(const s of r.sourcePages){
 const present=[...s.wayback.originals,
  ...s.commonCrawl.collections.flatMap(c=>c.originalAttempts)].filter(x=>
   x.originalStatus==='sha1_authenticated_original_publisher_html'||x.originalStatus==='sha1_authenticated_original_commoncrawl_warc_html');
 for(const original of present){
  if(!receipt.sourceOriginals.some(p=>p.id===s.id&&p.captureUtc===original.utc
    &&p.indexedSha1Base32===original.indexedOriginalSha1
    &&p.rawOriginalHtmlSha256===original.originalBodySha256
    &&p.rawOriginalHtmlBytes===original.originalBodyBytes))
  {console.error('Previously unpinned public original source receipt',JSON.stringify({id:s.id,utc:original.utc,indexedSha1:original.indexedOriginalSha1,rawSha256:original.originalBodySha256,bytes:original.originalBodyBytes,originalStatus:original.originalStatus}));
   throw Error('New or changed historical original requires independent source-receipt review');}
 }
}
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({
 version:r.version,urlLeads:r.publicFirstPartyUrlsTested,previouslyKnownUrlLeads:r.previouslyKnownResearchLeadUrls,
 newUrlLeads:r.newlyDiscoveredFirstPartyUrlLeads,
 distinctNamedMemberPeople:r.distinctNamedStateSenatorsInSelectedPages,
 authenticHistoricalOriginalHtmlCaptures:r.independentlySha1AuthenticatedOriginalHtmlCaptures,
 records:r.sourcePages.map(x=>({
  id:x.id,day:x.publisherDisplayedDay,sourceType:x.sourceType,
  attribution:x.attributionClass,people:x.namedIndividualsForMembershipCheck,
  current:x.current.status,currentCuePresence:x.current.sourceCuePresence,
  wayback:x.wayback.status,indexedWaybackCount:x.wayback.candidates,
  verifiedWaybackBodies:x.wayback.originals.map(o=>({utc:o.utc,status:o.originalStatus,
   sourceSha256:o.originalBodySha256,bytes:o.originalBodyBytes,selectedCues:o.selectedCues})),
  commonCrawl:x.commonCrawl.collections.map(c=>({collection:c.collection,index:c.indexStatus,candidates:c.indexedCandidates,
   captures:c.originalAttempts.map(o=>({utc:o.utc,status:o.originalStatus,sourceSha256:o.originalBodySha256,bytes:o.originalBodyBytes}))})),
  authenticatedBodies:x.historicallySha1AuthenticatedOriginalHtmlCaptures,
  earliestVerifiedOriginalUtc:x.earliestActuallyVerifiedOriginalCaptureUtc,
  jointCaucusNotThreeDirectQuotes:x.caucusCollectiveStatementNotThreePersonalQuotes,
  postEventNotEarlierVoteEvidence:x.postEventStatementCannotForecastEarlierEvent
 })),
 noRawHTMLSourceAudioOrPrivateDataSaved:true,noForecastProductionChanges:true
}));
