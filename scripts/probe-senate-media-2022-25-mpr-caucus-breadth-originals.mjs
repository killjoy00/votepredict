/**
 * Public first-party 2022-25 Minnesota senator media breadth audit.
 * Exact MPR episode audio/transcript pages + 2025 two actual Senate caucus
 * sites. No raw HTML, PDF, audio or WARC persisted; only metadata/hashes and
 * short cue boolean checks. Context and post-event reactions are NOT future
 * vote evidence, and joint-caucus text is NOT individual verbatim speech.
 */
import {probeWayback,probeCommonCrawl,probeCurrentFirstParty} from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
export const VERSION='senate-media-mpr-caucus-eight-senator-breadth-source-proof-v1';
const MPR='https://www.mprnews.org/episode/',DFL='https://senatedfl.mn/',GOP='https://www.mnsenaterepublicans.com/';
export const LEADS=Object.freeze([
 {
 id:'2022-benson-kunesh-mpr-radio-interviews',
 date:'2022-02-23',url:MPR+'2022/02/23/measures-give-parents-more-control-over-instruction-await-votes',
 attributionClass:'host_describes_named_state_senator_interviews_audio_without_individual_full_speaker_turn',
 storyType:'state_senator_radio_interview',
 namedIndividualSenators:['Michelle Benson','Mary Kunesh'],
 selected:[{name:'Michelle Benson',lrl:15322,cue:'sen. michelle benson'},
           {name:'Mary Kunesh',lrl:15466,cue:'sen. mary kunesh'}],
 topic:'school_parents_rights_curriculum',priorKnownSourceLead:true,
 collectionIds:['CC-MAIN-2022-21','CC-MAIN-2022-49'],
 historicalQuoteCandidate:false,postEvent:true
 },
 {
 id:'2022-parental-rights-mpr-second-episode',
 date:'2022-02-23',url:MPR+'2022/02/23/a-closer-look-at-the-parents-bill-of-rights-at-the-minnesota-legislature',
 attributionClass:'separate_same_day_mpr_publisher_audio_page_no_senator_transcript_confirmed',
 storyType:'potential_same_day_audio_program_or_alias_not_verified',
 namedIndividualSenators:[],
 selected:[{name:'unattributed publisher topic lead',lrl:null,cue:"parents' bill of rights"}],
 topic:'school_parents_rights_curriculum',priorKnownSourceLead:true,
 collectionIds:['CC-MAIN-2022-21','CC-MAIN-2022-49'],
 historicalQuoteCandidate:false,postEvent:true
 },
 {
 id:'2023-steve-cwodzinski-education-funding',
 date:'2023-01-17',url:MPR+'2023/01/17/what-do-dfl-lawmakers-mean-by-fully-funding-schools-in-the-state',
 attributionClass:'current_explicit_state_senator_printed_audio_transcript_turn',
 storyType:'state_senator_audio_interview',
 namedIndividualSenators:['Steve Cwodzinski'],
 selected:[{name:'Steve Cwodzinski',lrl:15478,cue:'difference between an unfunded mandate and a funded mandate'}],
 topic:'school_education_funding_and_funded_mandates',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2023-14','CC-MAIN-2023-23'],historicalQuoteCandidate:true,postEvent:false
 },
 {
 id:'2023-john-hoffman-mississippi-compact',
 date:'2023-09-13',url:MPR+'2023/09/13/it-would-be-the-biggest-compact-ever-proposal-looks-to-protect-mississippi-river',
 attributionClass:'current_explicit_state_senator_printed_audio_transcript_turn',
 storyType:'state_senator_audio_interview',
 namedIndividualSenators:['John Hoffman'],
 selected:[{name:'John Hoffman',lrl:15381,cue:'it would be the largest compact ever'}],
 topic:'mississippi_river_interstate_water_compact',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2023-40','CC-MAIN-2023-50'],historicalQuoteCandidate:true,postEvent:false
 },
 {
 id:'2024-zach-duckworth-free-meals',
 date:'2024-09-09',url:MPR+'2024/09/09/with-costs-ballooning-whats-the-future-of-universal-school-lunch-programs',
 attributionClass:'current_explicit_state_senator_printed_audio_transcript_turn',
 storyType:'state_senator_audio_interview',
 namedIndividualSenators:['Zach Duckworth'],
 selected:[{name:'Zach Duckworth',lrl:15558,cue:'recipient of an unfunded mandate'}],
 topic:'school_meals_fiscal_impact_after_2023_legislation',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2024-46','CC-MAIN-2025-05'],historicalQuoteCandidate:true,postEvent:true
 },
 {
 id:'2025-sandra-pappas-capital-bonding',
 date:'2025-03-25',url:MPR+'2025/03/25/legislator-says-its-bad-timing-for-397-million-update-to-xcel-energy-center',
 attributionClass:'current_explicit_state_senator_printed_audio_transcript_turn',
 storyType:'state_senator_audio_interview',
 namedIndividualSenators:['Sandra Pappas'],
 selected:[{name:'Sandra Pappas',lrl:10503,cue:"it's just the timing isn't very good"}],
 topic:'bonding_stadium_downtown_housing_and_budget_constraints',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2025-18','CC-MAIN-2025-21'],historicalQuoteCandidate:true,postEvent:false
 },
 {
 id:'2025-pha-individual-caucus-child-protection',
 date:'2025-03-20',url:DFL+'senator-susan-pha-statement-on-charges-against-justin-eichorn/',
 attributionClass:'individual_named_senator_original_party_caucus_published_direct_statement',
 storyType:'first_party_state_senate_caucus_individual_issued_press_statement',
 namedIndividualSenators:['Susan Pha'],
 selected:[{name:'Susan Pha',lrl:15583,cue:'i am committed to strengthening protections for children'}],
 topic:'child_protection_human_trafficking_response_after_charges',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2025-13','CC-MAIN-2025-18'],historicalQuoteCandidate:true,postEvent:true
 },
 {
 id:'2025-senate-asian-pacific-joint-caucus-sgu-veterans',
 date:'2025-04-23',url:DFL+'senate-minnesota-asian-pacific-caucus-statement-on-passage-of-senate-veterans-omnibus-bill/',
 attributionClass:'collective_three_senator_named_caucus_statement_not_individual_susan_pha_quote',
 storyType:'first_party_state_senate_party_caucus_joint_press_statement',
 namedIndividualSenators:['Susan Pha','Tou Xiong','Foung Hawj'],
 selected:[{name:'Minnesota Senate Asian Pacific Caucus',lrl:null,cue:'by including sgu veteran designation on id cards'}],
 topic:'special_guerrilla_units_veterans_recognition_after_passage',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2025-21','CC-MAIN-2025-26'],historicalQuoteCandidate:false,postEvent:true
 },
 {
 id:'2025-coleman-individual-caucus-school-security',
 date:'2025-08-27',url:GOP+'sen-coleman-statement-on-annunciation-church-and-school-shooting/',
 attributionClass:'individual_named_senator_original_party_caucus_published_direct_statement',
 storyType:'first_party_state_senate_caucus_individual_issued_press_statement',
 namedIndividualSenators:['Julia Coleman'],
 selected:[{name:'Julia Coleman',lrl:15556,cue:'now is the time to make school security funding a priority'}],
 topic:'school_security_public_safety_reaction_after_shooting',priorKnownSourceLead:false,
 collectionIds:['CC-MAIN-2025-35','CC-MAIN-2025-40'],historicalQuoteCandidate:true,postEvent:true
 }
].map(x=>Object.freeze({...x,quoted:Object.freeze(x.selected.map(q=>Object.freeze({
 senator:q.name,lrl:q.lrl===null?'https://www.lrl.mn.gov/legdb/':'https://www.lrl.mn.gov/legdb/fulldetail?ID='+q.lrl,
 cue:q.cue,attribution:x.attributionClass}))),displayedDay:x.date,ccCollections:Object.freeze(x.collectionIds)})));
const VALID_HOSTS=new Set(['www.mprnews.org','senatedfl.mn','www.mnsenaterepublicans.com']);
export function validateLeads(list=LEADS){
 if(!Array.isArray(list)||list.length!==9)throw Error('Unexpected nine selected public source URLs');
 const ids=new Set(),urls=new Set();let previously=0;
 for(let i=0;i<list.length;i++){
  const l=list[i],s=LEADS[i],u=new URL(l.url);
  if(JSON.stringify(l)!==JSON.stringify(s)||ids.has(l.id)||urls.has(l.url)
   ||u.protocol!=='https:'||!VALID_HOSTS.has(u.hostname)||u.port||u.search||u.hash||u.username||u.password
   ||l.quoted?.length!==l.selected?.length||l.quoted.some(q=>q.cue!==q.cue.toLowerCase())
   ||l.date.slice(0,4)!==['2022','2022','2023','2023','2024','2025','2025','2025','2025'][i])
   throw Error('Unapproved original research lead');
  if(u.hostname==='www.mprnews.org'&&!u.pathname.startsWith('/episode/'+l.date.replaceAll('-','/')+'/'))throw Error('Wrong MPR day');
  if(u.hostname==='senatedfl.mn'&&i!==6&&i!==7)throw Error('Wrong party original lead');
  if(u.hostname==='www.mnsenaterepublicans.com'&&i!==8)throw Error('Wrong original lead');
  if(l.priorKnownSourceLead)previously++;
  ids.add(l.id);urls.add(l.url);
 }
 if(previously!==2||new Set(list.flatMap(l=>l.namedIndividualSenators)).size!==10)throw Error('Person/sample cardinality changed');
 return list;
}
function keepPublicArchiveShort(replay){
 return {utc:replay.captureUtc??null,indexedOriginalSha1:replay.indexedOriginalSha1??null,
  originalBodySha256:replay.rawOriginalSha256??null,
  originalBodyBytes:replay.originalBytes??replay.rawBytes??null,
  originalStatus:replay.status,
  selectedCues:replay.shortCues?.map(x=>({subject:x.senator,foundSomewhereOnOriginalPage:x.cueFound,
   directSpeakerTurnVerified:false,fullVerbatimTextApproved:false}))??null,
  anyCurrentPdfOrAudioHistoricallyAuthenticated:false};
}
export async function probeLead(lead,f=fetch){
 const current=await probeCurrentFirstParty(lead,f);
 const [wayback,common]=await Promise.all([probeWayback(lead,f),probeCommonCrawl(lead,f)]);
 const wb=wayback.originalHtmlReplayAttempts.map(keepPublicArchiveShort);
 const crawl=common.queriedCollections.map(c=>({
  collection:c.collection,indexStatus:c.indexStatus,
  indexedCandidates:c.indexedCandidates,originalAttempts:c.originalWarcReplayAttempts.map(keepPublicArchiveShort)
 }));
 const all=[...wb,...crawl.flatMap(c=>c.originalAttempts)].filter(x=>
  x.originalStatus==='sha1_authenticated_original_publisher_html'
  ||x.originalStatus==='sha1_authenticated_original_commoncrawl_warc_html');
 return {
  id:lead.id,url:lead.url,publisherDisplayedDay:lead.date,sourceType:lead.storyType,
  attributionClass:lead.attributionClass,topic:lead.topic,
  namedIndividualsForMembershipCheck:lead.namedIndividualSenators,
  individualVerbatimSpeakerTurnNotApproved:true,
  caucusCollectiveStatementNotThreePersonalQuotes:lead.id.includes('asian-pacific-joint'),
  2022SecondAudioUrlNotEstablishedAsSameOriginalAsMain:lead.id==='2022-parental-rights-mpr-second-episode',
  postEventStatementCannotForecastEarlierEvent:lead.postEvent,
  priorKnownSourceLead:lead.priorKnownSourceLead,
  current:{status:current.status,sourceSha256:current.rawCurrentSha256,bytes:current.rawBytes,
   sourceCuePresence:current.cues?.map(x=>({subject:x.senator,cueFound:x.cueFound,
    visiblePageCueNotOriginalSpeakerTurnProof:true}))??null},
  wayback:{status:wayback.indexStatus,candidates:wayback.indexCandidates,
   firstPagePossiblyTruncated:wayback.firstPagePossiblyTruncated,originals:wb},
  commonCrawl:{collections:crawl},
  historicallySha1AuthenticatedOriginalHtmlCaptures:all.length,
  distinctAuthenticatedOriginalRawSha256:new Set(all.map(x=>x.originalBodySha256)).size,
  earliestActuallyVerifiedOriginalCaptureUtc:all.length?all.map(x=>x.utc).sort()[0]:null,
  acceptedWholePersonalQuotes:0,
  noFirstPublicAtPublisherDayOrSenateVotePredictionCertified:true
 };
}
export async function runMprAndCaucusSenateEvidenceBreadth(f=fetch){
 const entries=validateLeads(),out=[];
 for(let i=0;i<entries.length;i+=2){
  const rows=await Promise.all(entries.slice(i,i+2).map(v=>probeLead(v,f)));
  out.push(...rows);
 }
 return {version:VERSION,localResearchDay:'2026-10-11',publicFirstPartyUrlsTested:entries.length,
  previouslyKnownResearchLeadUrls:entries.filter(x=>x.priorKnownSourceLead).length,
  newlyDiscoveredFirstPartyUrlLeads:entries.filter(x=>!x.priorKnownSourceLead).length,
  explicitHistorical2021to2025StudyWindow:true,
  displayedSourceYears:[2022,2023,2024,2025],
  distinctNamedStateSenatorsInSelectedPages:new Set(entries.flatMap(x=>x.namedIndividualSenators)).size,
  sourcePages:out,
  independentlySha1AuthenticatedOriginalHtmlCaptures:out.reduce((n,x)=>n+x.historicallySha1AuthenticatedOriginalHtmlCaptures,0),
  senatorWholeVerbatimQuotesHumanApproved:0,memberVotesAuthenticated:0,
  originalAudioOrTranscriptPDFArchiveBinariesShaVerified:0,
  sourceSampleIsNotPublisherOrStatewideCensus:true,
  noPrivateDatabaseCollectorIngestionOrForecastChanges:true,
  noFullRawHtmlAudioPdfWarcSaved:true};
}
