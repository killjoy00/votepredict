/**
 * Track D #987 public-only, read-only historic archive diagnostics for a
 * possible 2023 HF100 Democratic YES / Republican NO cross-party comparison.
 * Publisher dates/pages are leads; no archival quote or YES label is approved
 * by this diagnostic. Original HTML/WARC/audio/PDF never written.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {probeWayback} from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';

export const VERSION='track-d-hf100-2023-crossparty-candidate-originals-v1';
export const VOTE_DATE='2023-04-28';
export const LEADS=Object.freeze([
  Object.freeze({
    id:'port-jan05-kstp-introduction',senator:'Lindsey Port',
    displayedDay:'2023-01-05',
    url:'https://kstp.com/kstp-news/local-news/house-dfl-introduces-bill-to-legalize-recreational-marijuana/',
    quoted:[{senator:'Lindsey Port',cue:'minnesotans have made it clear that they are ready to move forward with the legalization of adult-use cannabis in our state'}],
    role:'same_day_reported_named_exact_quote',ccCollections:['CC-MAIN-2023-14','CC-MAIN-2023-23']
  }),
  Object.freeze({
    id:'port-jan06-redlake-reported-release',senator:'Lindsey Port',
    displayedDay:'2023-01-06',
    url:'https://www.redlakenationnews.com/story/2023/01/06/politics/dfl-introduces-legislation-to-legalize-adult-use-cannabis/111129.html',
    quoted:[{senator:'Lindsey Port',cue:'minnesotans have made it clear that they are ready to move forward with the legalization of adult-use cannabis in our state'}],
    role:'locally_published_quoted_release_syndication_not_separate_speech',ccCollections:['CC-MAIN-2023-14','CC-MAIN-2023-23']
  }),
  Object.freeze({
    id:'oumou-jan05-mpr-cannabis',senator:'Clare Oumou Verbeten',
    displayedDay:'2023-01-05',
    url:'https://www.mprnews.org/story/2023/01/05/push-for-legal-marijuana-begins-at-minnesota-capitol',
    quoted:[{senator:'Clare Oumou Verbeten',cue:'we are going to get this done in 2023'}],
    role:'named_individually_attributed_reporter_quote',ccCollections:['CC-MAIN-2023-14','CC-MAIN-2023-23']
  }),
  Object.freeze({
    id:'port-jan30-marijuana-herald-committee',senator:'Lindsey Port',
    displayedDay:'2023-01-30',
    url:'https://themarijuanaherald.com/2023/01/third-minnesota-senate-committee-approves-bill-to-legalize-marijuana/',
    quoted:[{senator:'Lindsey Port',cue:'prohibition of cannabis is a failed system that has not achieved the desired goals'}],
    role:'dated_reporter_named_quote_on_sf73',ccCollections:['CC-MAIN-2023-14','CC-MAIN-2023-23']
  })
]);
const iso=t=>typeof t==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(t)&&t<VOTE_DATE+'T00:00:00Z';
export function allowed(leads=LEADS){
  if(!Array.isArray(leads)||leads.length!==4||new Set(leads.map(x=>x.url)).size!==4)throw Error('unapproved lead population');
  for(let i=0;i<leads.length;i++){
    const x=leads[i],p=LEADS[i],u=new URL(x.url);
    if(x!==p||!['https:'].includes(u.protocol)||u.search||u.hash||u.username||u.password||u.port||
      x.displayedDay<'2023-01-01'||x.displayedDay>='2023-04-28'||x.quoted.length!==1||
      x.quoted[0].senator!==x.senator||x.quoted[0].cue.length<35)throw Error('unapproved source candidate');
  }
  return true;
}
export function classifyReplay(row,lead){
  const cue=row.shortCues?.find(x=>x.senator===lead.senator);
  const exact=row.status==='sha1_authenticated_original_publisher_html'&&
    /^[A-Z2-7]{32}$/.test(row.indexedOriginalSha1??'')&&
    /^[0-9a-f]{64}$/.test(row.rawOriginalSha256??'')&&
    Number.isSafeInteger(row.originalBytes)&&row.originalBytes>1000&&iso(row.captureUtc);
  return {captureUtc:row.captureUtc??null,indexedOriginalSha1Base32:row.indexedOriginalSha1??null,
    status:row.status,rawOriginalSha256:exact?row.rawOriginalSha256:null,
    exactOriginalBytes:exact?row.originalBytes:null,
    cueInAuthenticatedPrevoteBody:exact&&cue?.cueFound===true,
    namedSpeakerNearOriginalCue:exact&&cue?.fullNameInNearbySourceText===true,
    independentlyBoundedOriginalWholeQuote:false,
    eligibleAsHistoricalStatementVotePair:false};
}
export async function run(f=fetch){
  allowed();const result=[];
  for(const lead of LEADS){
    const p=await probeWayback(lead,f);
    const replay=p.originalHtmlReplayAttempts.map(x=>classifyReplay(x,lead));
    result.push({id:lead.id,senator:lead.senator,url:lead.url,
      currentPublisherDateIsNotArchiveAuthentication:true,
      archiveIndex:p.indexStatus,indexCandidates:p.indexCandidates,
      limitedToFirstTwoOriginalReplays:true,replays:replay,
      archivedOriginalSpeakerOwnershipNotYetIndependentlyRechecked:true,
      status:replay.some(x=>x.cueInAuthenticatedPrevoteBody&&x.namedSpeakerNearOriginalCue)
        ?'authenticated_prevoting_original_cue_needs_bounded_speaker_verification'
        :'not_yet_qualified_historic_original_unknown'});
  }
  return {version:VERSION,diagnosticOnly:true,readOnlyPublicSources:true,
    voteBill:'HF100',voteDate:VOTE_DATE,
    independentlyAuthenticatedFullPublisherQuotations:0,
    approvedHistoricalCrossPartyResearchPairs:0,
    noProductionIngestionOrDatabaseOrModelChanges:true,candidates:result};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
  const i=process.argv.indexOf('--output'),out=process.argv[i+1];
  if(i<0||!/^artifacts\/track-d-hf100-crossparty-candidates\.json$/.test(out||''))throw Error('metadata-only output required');
  const r=await run();
  mkdirSync('artifacts',{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');
  console.log('TRACK_D_HF100_CROSSPARTY_CANDIDATES='+JSON.stringify(r));
}
