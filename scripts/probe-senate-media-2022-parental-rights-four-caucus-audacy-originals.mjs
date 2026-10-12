/**
 * VotePredict Track D #987, public February 2022 parent-curriculum interviews.
 * Two previously unlisted exact publisher URLs:
 * (a) ONE first-party Senate GOP caucus release with FOUR individually named
 * 2022 state senators and (b) ONE separately syndicated WCCO/Audacy Benson
 * reporter article. Not the Feb 23 MPR Benson/Kunesh named episode.
 *
 * Exact Wayback indexed SHA1 + raw downloaded SHA256 proofs only. Selected
 * Common Crawl original WARC proofs are allowed only through the preexisting
 * fail-closed parser. No article/audio data, private vote rows or forecast.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import first18 from '../docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json' with {type:'json'};
import existing25 from '../docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json' with {type:'json'};
import existing6 from '../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
import {probeWayback,probeCommonCrawl,probeCurrentFirstParty}
 from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';

export const VERSION='track-d-2022-four-caucus-senators-distinct-wcco-benson-two-original-source-audit-v1';
const LRL='https://www.lrl.mn.gov/legdb/fulldetail?ID=';
export const ORIGINALS=Object.freeze([
 Object.freeze({
  id:'2022-feb14-four-gop-senators-parents-rights',
  displayedDay:'2022-02-14',
  url:'https://www.mnsenaterepublicans.com/senate-republicans-propose-parents-bill-of-rights/',
  reportedPublisher:'Minnesota Senate Republican Caucus',
  attributionType:'four_separate_named_publisher_printed_senator_quotes_on_one_article',
  ccCollections:Object.freeze(['CC-MAIN-2022-21','CC-MAIN-2022-49']),
  quoted:Object.freeze([
   Object.freeze({senator:'Justin Eichorn',cue:'it is the fundamental right of parents to direct the upbringing and education of their children',lrl:LRL+'15480'}),
   Object.freeze({senator:'Michelle Benson',cue:'parents have the right to know what their kids are being taught',lrl:LRL+'15322'}),
   Object.freeze({senator:'Paul Gazelka',cue:'children are most successful when their parents are engaged and involved in their education',lrl:LRL+'12263'}),
   Object.freeze({senator:'Roger Chamberlain',cue:"it is a parent's absolute, fundamental right to be actively involved",lrl:LRL+'15325'})
  ])
 }),
 Object.freeze({
  id:'2022-feb15-wcco-audacy-benson-parents-education',
  displayedDay:'2022-02-15',
  url:'https://www.audacy.com/talk980am/news/national/minnesota-gop-propose-parental-rights-bill-for-the-classroom',
  reportedPublisher:'WCCO radio reporting syndicated by Audacy',
  attributionType:'one_reporter_attributed_named_senator_interview_excerpt_pending_historical_source',
  ccCollections:Object.freeze(['CC-MAIN-2022-21','CC-MAIN-2022-49']),
  quoted:Object.freeze([
   Object.freeze({senator:'Michelle Benson',cue:'parents are primarily responsible for their kids',lrl:LRL+'15322'})
  ])
 })
]);
export function validateNewLeads(leads=ORIGINALS){
 if(leads!==ORIGINALS||leads.length!==2||
  first18.version!=='senate-media-2021-25-public-firsthand-remarks-discovery-v1'||
  first18.selectedNewPublicSourcePages?.length!==18||
  existing25.version!=='senate-media-2021-25-public-broader-source-discovery-v1'||
  existing25.selectedPublicSourceLeads?.length!==25||
  existing6.sources?.length!==6)throw Error('unexpected cohort or ledgers');
 const prior=new Set([
  ...first18.selectedNewPublicSourcePages.map(x=>x.sourceUrl),
  ...existing25.selectedPublicSourceLeads.map(x=>x.url),
  ...existing6.sources.map(x=>x.url)
 ]);
 const ids=new Set(),urls=new Set(),persons=new Set();
 for(let i=0;i<leads.length;i++){
  const s=leads[i],u=new URL(s.url);
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||
   u.hostname!==(i===0?'www.mnsenaterepublicans.com':'www.audacy.com')||
   s.displayedDay!==(i===0?'2022-02-14':'2022-02-15')||
   !s.url.includes(i===0?'senate-republicans-propose-parents-bill-of-rights':'minnesota-gop-propose-parental-rights-bill-for-the-classroom')||
   urls.has(s.url)||ids.has(s.id)||prior.has(s.url)||
   s.quoted.length!==(i===0?4:1)||
   JSON.stringify(s.ccCollections)!==JSON.stringify(['CC-MAIN-2022-21','CC-MAIN-2022-49']))
   throw Error('unapproved 2022 exact original source, host, cohort or senator');
  urls.add(s.url);ids.add(s.id);
  for(const q of s.quoted){
   if(!/^[a-z]+(?: [a-z]+)+$/.test(q.senator.toLowerCase())||
    !/^[a-z '.,-]{20,160}$/.test(q.cue)||
    !/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(q.lrl))
    throw Error('unapproved individual original printed-source cue / service identity');
   persons.add(q.senator);
  }
 }
 if(persons.size!==4||urls.size!==2)throw Error('repeated Michelle is one senator and two original URL leads');
 return leads;
}
export function attributableCues(statusItems,lead){
 if(!ORIGINALS.includes(lead)||!Array.isArray(statusItems))throw Error('invalid cue population');
 const group=statusItems.filter(x=>x.status==='sha1_authenticated_original_publisher_html'||
   x.status==='sha1_authenticated_original_commoncrawl_warc_html');
 return lead.quoted.map((person,i)=>({
  senator:person.senator,
  officialMemberHistory:person.lrl,
  shortHistoricalIssueCueFoundInAtLeastOneAuthenticatedOriginal:group.some(q=>q.shortCues?.[i]?.cueFound===true),
  fullNameNearbyInAtLeastOneAuthenticatedOriginal:group.some(q=>q.shortCues?.[i]?.fullNameInNearbySourceText===true),
  directOriginalWrittenQuoteBoundaryVerified:false,
  firstPersonRecordedAudioAuthenticated:false,
  wholeSenatorUtteranceHumanApproved:false
 }));
}
function metadata(x){
 return {archiveCaptureUtc:x.captureUtc||null,indexedOriginalSha1Base32:x.indexedOriginalSha1||x.indexedSha1Base32||null,
  downloadedRawHtmlSha256:x.rawOriginalSha256||null,rawHtmlBytes:x.originalBytes??x.rawBytes??null,
  independentlyVerifiedOriginStatus:x.status,
  candidateCues:x.shortCues?.map(y=>({senator:y.senator,fragmentFound:y.cueFound,
   namedSenatorNearby:y.fullNameInNearbySourceText}))??null};
}
export async function auditOne(lead,f=fetch){
 if(!ORIGINALS.includes(lead))throw Error('not selected exact original first-party publisher URL');
 const [current,wayback,cc]=await Promise.all([
  probeCurrentFirstParty(lead,f),probeWayback(lead,f),probeCommonCrawl(lead,f)
 ]);
 const waybackCaptures=wayback.originalHtmlReplayAttempts.map(metadata);
 const ccCaptures=cc.queriedCollections.map(c=>({collection:c.collection,indexStatus:c.indexStatus,
  indexedCandidateCount:c.indexedCandidates,
  downloadedOriginalVersions:c.originalWarcReplayAttempts.map(metadata)}));
 const versions=[...waybackCaptures,...ccCaptures.flatMap(x=>x.downloadedOriginalVersions)];
 const exact=versions.filter(x=>
  ['sha1_authenticated_original_publisher_html','sha1_authenticated_original_commoncrawl_warc_html'].includes(x.independentlyVerifiedOriginStatus)&&
  /^[A-Z2-7]{32}$/.test(x.indexedOriginalSha1Base32||'')&&
  /^[0-9a-f]{64}$/.test(x.downloadedRawHtmlSha256||'')&&
  Number.isSafeInteger(x.rawHtmlBytes)&&x.rawHtmlBytes>1000);
 const unique=[...new Map(exact.map(v=>[v.archiveCaptureUtc+'|'+v.downloadedRawHtmlSha256,v])).values()];
 return {
  leadId:lead.id,originalPublisherUrl:lead.url,currentPageDisplayedDate:lead.displayedDay,
  independentlyNamedSenators:lead.quoted.map(q=>({name:q.senator,lrl:q.lrl})),
  publisherAttributionCategory:lead.attributionType,
  currentPageObserved:{status:current.status,rawCurrentPageSha256:current.rawCurrentSha256||null,
   rawCurrentPageBytes:current.rawBytes??null,currentPageShortCueObserved:current.cues?.map(x=>({speaker:x.senator,shortCueFound:x.cueFound,namedSenatorNearby:x.fullNameInNearbySourceText}))??null,
   currentWebsiteNotHistoricalOriginal:true},
  wayback:{indexStatus:wayback.indexStatus,reportedCandidates:wayback.indexCandidates,
   originalBodyVersions:waybackCaptures},
  selectedCommonCrawlCollections:ccCaptures,
  authenticHistoricalOriginalVersions:unique,
  earliestAuthenticatedOriginalArchiveUtc:unique.length?unique.map(v=>v.archiveCaptureUtc).sort()[0]:null,
  historicalSelectedSpeakerCueChecks:lead.quoted.map((q,i)=>({
   senator:q.senator,shortCueAuthenticatedInOriginal:unique.some(x=>x.candidateCues?.[i]?.fragmentFound),
   fullNameNearOriginalCue:unique.some(x=>x.candidateCues?.[i]?.namedSenatorNearby),
   boundedSpeakerQuoteTurnAndWholeVerbatimStillUnapproved:true
  })),
  notVerbatimTranscriptOrRecordedVoice:true,
  unavailableOrEmptyArchiveIndexesAreUnknownNotGlobalAbsence:true
 };
}
export async function run(f=fetch){
 validateNewLeads();const sources=[];
 for(const original of ORIGINALS)sources.push(await auditOne(original,f));
 return {version:VERSION,researchDayLocal:'2026-10-12',
  publisherUrlLeadsNewToPrevious18_25_6UrlCohorts:2,
  uniqueHistoricallyServingSenatorsAcrossSelectedUrls:4,
  namedSpeakerShortCueSourcePairs:5,
  individualPublisherArticlesConsidered:2,
  oldAdjacentMprBensonKuneshShowNotSubstituted:true,
  sources,
  historicalOriginalPublisherUrlsAuthenticated:sources.filter(x=>x.authenticHistoricalOriginalVersions.length>0).length,
  historicalOriginalHtmlVersionsAuthenticated:sources.reduce((n,x)=>n+x.authenticHistoricalOriginalVersions.length,0),
  individuallyBoundedHistoricalSenatorQuotedTurnsApproved:0,
  humanApprovedCompleteHistoricQuotes:0,
  originalRecordedSpeechMP3Authenticated:0,
  historic2022FirstPublisherPostingClockAuthenticated:0,
  independentSenateVotesOrPredictiveAsOfCutoffsVerified:0,
  noOriginalHtmlAudioWarcOrTranscriptPersisted:true,
  noPrivateSourceDocumentRowsQueried:true,
  noProductionCollectorModelDatabaseServingForecastChanges:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const pos=process.argv.indexOf('--output'),file=process.argv[pos+1];
 if(pos<0||!/^artifacts\/[A-Za-z0-9._-]+\.json$/.test(file||''))throw Error('metadata-only output path required');
 const result=await run();
 mkdirSync('artifacts',{recursive:true});writeFileSync(file,JSON.stringify(result,null,2)+'\n');
 console.log('TRACK_D_2022_FOUR_CAUCUSES_AUDACY_ORIGINALS='+JSON.stringify({
  newOriginalUrlLeads:result.publisherUrlLeadsNewToPrevious18_25_6UrlCohorts,
  authenticUrlCount:result.historicalOriginalPublisherUrlsAuthenticated,
  authenticOriginalVersions:result.historicalOriginalHtmlVersionsAuthenticated,
  sourceSummaries:result.sources.map(s=>({id:s.leadId,originalUrl:s.originalPublisherUrl,
   currentStatus:s.currentPageObserved.status,currentSha256:s.currentPageObserved.rawCurrentPageSha256,
   currentCues:s.currentPageObserved.currentPageShortCueObserved,
   earliest:s.earliestAuthenticatedOriginalArchiveUtc,
   archivedOriginals:s.authenticHistoricalOriginalVersions,waybackIndex:s.wayback.indexStatus,
   commonCrawl:s.selectedCommonCrawlCollections.map(q=>({collection:q.collection,indexStatus:q.indexStatus})),
   authenticNamedShortCues:s.historicalSelectedSpeakerCueChecks}))
 }));
}
