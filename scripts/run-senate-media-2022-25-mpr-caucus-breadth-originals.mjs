import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runMprAndCaucusSenateEvidenceBreadth} from './probe-senate-media-2022-25-mpr-caucus-breadth-originals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Only --output artifacts/public-bounded-source-metadata.json');
const dest=resolve(args[1]);
if(!dest.startsWith(resolve(root,'artifacts')+'/')||!dest.endsWith('.json'))throw Error('Only source metadata under ignored artifacts/');
const r=await runMprAndCaucusSenateEvidenceBreadth();
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
