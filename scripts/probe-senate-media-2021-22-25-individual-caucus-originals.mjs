/**
 * Seven exact original MN Senate caucus public statement sources, 2021/22/25.
 * Incremental original evidence for Foung Hawj, Paul Gazelka, Bill Weber,
 * Susan Pha and Julia Coleman, including previously unresolved exact Pha
 * March / Coleman August 2025 originals. No source text stored, no model or
 * private VotePredict data, no implied pre-event/publication timeline.
 */
import {probeWayback,probeCommonCrawl,probeCurrentFirstParty} from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
export const VERSION='senate-media-2021-22-25-seven-first-party-individual-originals-v1';
const DFL='https://senatedfl.mn/',GOP='https://www.mnsenaterepublicans.com/';
const l=[
 ['2021-hawj-start-session','2021-01-05',DFL+'senator-foung-hawj-sworn-in-as-senate-district-67-senator/',
  'Foung Hawj',15347,'we have much work to do in building a brighter future','2021 state budget, environment and veterans legislative priorities',false],
 ['2022-gazelka-crime-reform-proposed','2022-01-14',GOP+'senator-paul-gazelka-announces-legislation-combating-minnesotas-weak-stance-on-crime/',
  'Paul Gazelka',15378,'minimum sentencing for carjackings','2022 prospective violent crime sentencing reform',false],
 ['2022-weber-state-surplus-proposals','2022-12-06',GOP+'senator-bill-weber-surplus-shows-minnesota-is-collecting-too-much-in-taxes-time-to-shift-focus-to-providing-relief-to-minnesotans/',
  'Bill Weber',15449,'meaningful ongoing tax relief','2023 prospective budget and tax relief',false],
 ['2025-coleman-education-committee-mandates','2025-01-22',GOP+'coleman-leads-effort-to-listen-to-school-concerns-regarding-education-mandates/',
  'Julia Coleman',15556,'one-size-fits-all mandates do not serve our schools well','education committee school mandates and local control after committee action',true],
 ['2025-pha-post-charges-child-protection','2025-03-20',DFL+'senator-susan-pha-statement-on-charges-against-justin-eichorn/',
  'Susan Pha',15583,'i am committed to strengthening protections for children','response to previously issued criminal charges',true],
 ['2025-pha-hoa-passage-remarks','2025-05-06',DFL+'homeowners-association-reform-package-passes-minnesota-senate/',
  'Susan Pha',15583,'we have crafted responsible, bipartisan legislation','HOA reform public remarks after Senate passage',true],
 ['2025-coleman-post-annunciation-school-security','2025-08-27',GOP+'sen-coleman-statement-on-annunciation-church-and-school-shooting/',
  'Julia Coleman',15556,'now is the time to make school security funding a priority','school safety reaction after shooting',true],
];
export const LEADS=Object.freeze(l.map(([id,day,url,senator,lrl,cue,topic,postEvent])=>Object.freeze({
 id,displayedDay:day,url,topic,senator,
 quoted:Object.freeze([Object.freeze({
  senator,lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID='+lrl,
  cue,attribution:'current_first_party_state_senate_party_caucus_individual_reported_direct_statement_not_certified_spoken_audio'
 })]),
 postEvent,noRecordedVoteEvidence:true,
 ccCollections:Object.freeze(day.startsWith('2021')?['CC-MAIN-2021-17','CC-MAIN-2021-25']:
 day.startsWith('2022-01')?['CC-MAIN-2022-05','CC-MAIN-2022-21']:
 day.startsWith('2022')?['CC-MAIN-2023-06','CC-MAIN-2023-14']:
 day.startsWith('2025-01')?['CC-MAIN-2025-08','CC-MAIN-2025-13']:
 day.startsWith('2025-03')?['CC-MAIN-2025-13','CC-MAIN-2025-18']:
 day.startsWith('2025-05')?['CC-MAIN-2025-21','CC-MAIN-2025-26']:
 ['CC-MAIN-2025-35','CC-MAIN-2025-40'])
})));
export function validateLeads(list=LEADS){
 if(!Array.isArray(list)||list.length!==7)throw Error('Seven curated historical individual-source leads expected');
 const ids=new Set(),urls=new Set();
 for(let i=0;i<list.length;i++){
  const v=list[i],expected=LEADS[i],u=new URL(v.url);
  if(JSON.stringify(v)!==JSON.stringify(expected)||ids.has(v.id)||urls.has(v.url)
   ||u.protocol!=='https:'||!['senatedfl.mn','www.mnsenaterepublicans.com'].includes(u.hostname)
   ||u.port||u.search||u.hash||u.username||u.password||!u.pathname.endsWith('/')
   ||!v.quoted[0].lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID=')
   ||v.quoted.length!==1)throw Error('Invalid originally selected real Minnesota Senate caucus member press source');
  ids.add(v.id);urls.add(v.url);
 }
 return list;
}
const trimArchive=o=>({
 utc:o.captureUtc??null,indexedSha1:o.indexedOriginalSha1??null,
 bodySha256:o.rawOriginalSha256??null,bodyBytes:o.originalBytes??o.rawBytes??null,
 replayStatus:o.status,
 shortCurrentSelectedPolicyFragmentFoundOnOriginalPage:o.shortCues?.[0]?.cueFound??null,
 originalPageAttributionNearbyNamedSenator:o.shortCues?.[0]?.fullNameInNearbySourceText??null,
 printedPublisherClaimNotFullAudioOrActualRecordedVote:true
});
export async function probeIndividualCaucusOriginal(lead,f=fetch){
 const current=await probeCurrentFirstParty(lead,f);
 const [wayback,common]=await Promise.all([probeWayback(lead,f),probeCommonCrawl(lead,f)]);
 const originalCaptures=[
  ...wayback.originalHtmlReplayAttempts.map(trimArchive),
  ...common.queriedCollections.flatMap(x=>x.originalWarcReplayAttempts.map(trimArchive))
 ];
 const verified=originalCaptures.filter(x=>x.replayStatus==='sha1_authenticated_original_publisher_html'
  ||x.replayStatus==='sha1_authenticated_original_commoncrawl_warc_html');
 return {id:lead.id,exactFirstPartySourceUrl:lead.url,publisherDisplayedDay:lead.displayedDay,
  senator:lead.senator,topic:lead.topic,statementClass:'first_party_named_senator_caucus_press_release_not_spoken_audio',
  postEventCannotPredictEarlierEvent:lead.postEvent,
  current:{status:current.status,rawSha256:current.rawCurrentSha256,rawBytes:current.rawBytes,
   chosenShortCueOnCurrentPage:current.cues?.[0]?.cueFound??null},
  originalWayback:{status:wayback.indexStatus,candidates:wayback.indexCandidates,
   firstPagePossiblyTruncated:wayback.firstPagePossiblyTruncated,
   originals:wayback.originalHtmlReplayAttempts.map(trimArchive)},
  originalCommonCrawl:{selectedCollections:common.queriedCollections.map(x=>({
    collection:x.collection,index:x.indexStatus,candidates:x.indexedCandidates,
    originals:x.originalWarcReplayAttempts.map(trimArchive)
  }))},
  authenticatedOriginalBodyCaptureCount:verified.length,
  earliestVerifiedOriginalHtmlCaptureUtc:verified.length?verified.map(x=>x.utc).sort()[0]:null,
  noIndependentlyProvenFirstPublishedMinute:true,
  statementTextNotVerbatimAudioOrForecastInput:true,
  actualMemberRecordedVoteNotVerified:true};
}
export async function runSevenCaucusIndividualSourceOriginals(f=fetch){
 const leads=validateLeads(),sources=[];
 for(let i=0;i<leads.length;i+=2)sources.push(...await Promise.all(leads.slice(i,i+2).map(l=>probeIndividualCaucusOriginal(l,f))));
 return {version:VERSION,localResearchDate:'2026-10-11',countExactFirstPartyOriginalLeadUrls:7,
  distinctNamedServingStateSenators:new Set(leads.map(x=>x.senator)).size,
  alreadyKnownSelectedLeadCount:2,additionalSelectedIndividualPressReleaseUrls:5,
  sources,authenticatedHistoricPublisherOriginalBodies:sources.reduce((n,x)=>n+x.authenticatedOriginalBodyCaptureCount,0),
  distinctOriginalUrlsHistoricallyAuthenticated:sources.filter(x=>x.authenticatedOriginalBodyCaptureCount>0).length,
  individualPrintedSenatorPressPolicySourceCandidates:7,
  wholeSenatorAudioQuotesHumanCertified:0,actualLegislativeMemberVotesVerified:0,
  noPublisherDisplayedDateSubstitutedForArchiveCapture:true,
  noPrivateSourceOrDbOrModelOrCollectorChanges:true,
  noRawArticleHtmlOrMediaPersisted:true};
}
